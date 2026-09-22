const prisma = require('../database/connection');
const ScheduleSlotModel = require('../models/ScheduleSlot');
const ClosedDayModel = require('../models/ClosedDay');
const { getMonthDateList, isoWeekday, ymd, dateOnly, daysInMonth } = require('../utils/date');
const { getChildId } = require('../utils/scope');

// Idempotent: only creates sessions that don't already exist for the
// (childId, date, plannedTrainerId, startTime) key. Existing sessions are
// never touched.
async function generateMonth(year, month) {
  const childId = await getChildId();
  const slots = await ScheduleSlotModel.listActive();
  const closedDays = await ClosedDayModel.listForMonth(year, month);
  const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));
  const monthDates = getMonthDateList(year, month);

  let created = 0;
  let skipped = 0;

  for (const date of monthDates) {
    const weekday = isoWeekday(date);
    const key = date.toISOString().slice(0, 10);
    const isClosed = closedSet.has(key);
    const slotsToday = slots.filter((s) => s.weekday === weekday);

    for (const slot of slotsToday) {
      const existing = await prisma.session.findUnique({
        where: {
          childId_date_plannedTrainerId_startTime: {
            childId,
            date,
            plannedTrainerId: slot.trainerId,
            startTime: slot.startTime,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.session.create({
        data: {
          childId,
          date,
          year,
          month,
          startTime: slot.startTime,
          endTime: slot.endTime,
          plannedTrainerId: slot.trainerId,
          status: isClosed ? 'CLOSED_DAY' : 'PLANNED',
        },
      });
      created++;
    }
  }

  return { created, skipped };
}

// Смена расписания посреди месяца (ТЗ v2, §2.18): пересоздаёт занятия от
// fromDate до конца её месяца по ТЕКУЩЕМУ (уже изменённому) шаблону.
// Трогает только PLANNED — уже отмеченные занятия не удаляются и не
// пересоздаются никогда, что бы ни говорил новый шаблон.
//
// Весь delete+create — одна интерактивная транзакция (аудит надёжности,
// фаза 1). Раньше это были раздельные вызовы prisma.*: рестарт процесса
// (например, деплой на Render) между deleteMany и циклом create мог
// оставить часть дней без единого PLANNED-занятия на срок до суток, пока
// их не досоздаст ночной generateMonth. Таймаут увеличен (как в
// backup.service.js) — последовательных findUnique+create внутри может
// быть несколько десятков.
async function regenerateFromDate(fromDateOnly) {
  const childId = await getChildId();
  const { year, month, day } = ymd(fromDateOnly);
  const total = daysInMonth(year, month);
  const dates = [];
  for (let d = day; d <= total; d++) dates.push(dateOnly(year, month, d));

  return prisma.$transaction(
    async (tx) => {
      const deleted = await tx.session.deleteMany({
        where: { childId, date: { in: dates }, status: 'PLANNED' },
      });

      const slots = await ScheduleSlotModel.listActive();
      const closedDays = await ClosedDayModel.listForMonth(year, month);
      const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));

      let created = 0;
      for (const date of dates) {
        const weekday = isoWeekday(date);
        const key = date.toISOString().slice(0, 10);
        const isClosed = closedSet.has(key);
        const slotsToday = slots.filter((s) => s.weekday === weekday);

        for (const slot of slotsToday) {
          const existing = await tx.session.findUnique({
            where: {
              childId_date_plannedTrainerId_startTime: {
                childId,
                date,
                plannedTrainerId: slot.trainerId,
                startTime: slot.startTime,
              },
            },
          });
          // Существующая запись тут — либо уже отмеченное занятие (не трогаем
          // никогда), либо PLANNED-занятие по слоту, который в новом шаблоне
          // не изменился (deleteMany его тоже удалил бы, но findUnique после
          // deleteMany гарантированно найдёт только то, что уцелело, т.е. не PLANNED).
          if (existing) continue;

          await tx.session.create({
            data: {
              childId,
              date,
              year,
              month,
              startTime: slot.startTime,
              endTime: slot.endTime,
              plannedTrainerId: slot.trainerId,
              status: isClosed ? 'CLOSED_DAY' : 'PLANNED',
            },
          });
          created++;
        }
      }

      return { deletedCount: deleted.count, created };
    },
    { timeout: 60000, maxWait: 15000 },
  );
}

module.exports = { generateMonth, regenerateFromDate };
