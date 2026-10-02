const prisma = require('../database/connection');
const ScheduleSlotModel = require('../models/ScheduleSlot');
const ClosedDayModel = require('../models/ClosedDay');
const TrainerPauseModel = require('../models/TrainerPause');
const { getMonthDateList, isoWeekday, ymd, dateOnly, daysInMonth, todayDateOnly, nowYearMonth } = require('../utils/date');
const { getChildId } = require('../utils/scope');
const { isPausedOn } = require('../utils/trainerPause');

async function pausesByTrainerForMonth(year, month) {
  const pauses = await TrainerPauseModel.listOverlappingMonth(year, month);
  const map = new Map();
  for (const p of pauses) {
    if (!map.has(p.trainerId)) map.set(p.trainerId, []);
    map.get(p.trainerId).push(p);
  }
  return map;
}

// Idempotent: only creates sessions that don't already exist for the
// (childId, date, plannedTrainerId, startTime) key. Existing sessions are
// never touched. Dates covered by a TrainerPause (§2.6.1) for that specific
// trainer are skipped entirely — paused specialist's sessions should not
// appear in the schedule/calendar at all, not just be excluded from money.
async function generateMonth(year, month) {
  const childId = await getChildId();
  const slots = await ScheduleSlotModel.listActive();
  const closedDays = await ClosedDayModel.listForMonth(year, month);
  const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));
  const monthDates = getMonthDateList(year, month);
  const pausesByTrainer = await pausesByTrainerForMonth(year, month);

  let created = 0;
  let skipped = 0;

  for (const date of monthDates) {
    const weekday = isoWeekday(date);
    const key = date.toISOString().slice(0, 10);
    const isClosed = closedSet.has(key);
    const slotsToday = slots.filter((s) => s.weekday === weekday);

    for (const slot of slotsToday) {
      if (isPausedOn(date, pausesByTrainer.get(slot.trainerId) || [])) continue;

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
      const pausesByTrainer = await pausesByTrainerForMonth(year, month);

      let created = 0;
      for (const date of dates) {
        const weekday = isoWeekday(date);
        const key = date.toISOString().slice(0, 10);
        const isClosed = closedSet.has(key);
        const slotsToday = slots.filter((s) => s.weekday === weekday);

        for (const slot of slotsToday) {
          if (isPausedOn(date, pausesByTrainer.get(slot.trainerId) || [])) continue;

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

// Пауза специалиста создана (§2.6.1, 02.10.2026) — немедленно убирает его
// уже сгенерированные, но ещё не отмеченные занятия из расписания/календаря
// на период паузы, вместо того чтобы ждать следующей ночной generateMonth.
// Трогает только PLANNED — уже отмеченные занятия (в т.ч. CLOSED_DAY)
// паузой не затрагиваются никогда, как и везде в этом файле. toDate=null
// (бессрочная пауза) не ограничивает диапазон удаления сверху — это просто
// удаляет всё, что уже существует с этой даты и дальше, будущие месяцы
// попросту не будут сгенерированы, пока пауза активна (см. generateMonth).
async function hideSessionsForPause(trainerId, fromDate, toDate) {
  return prisma.session.deleteMany({
    where: {
      plannedTrainerId: trainerId,
      status: 'PLANNED',
      date: { gte: fromDate, ...(toDate ? { lte: toDate } : {}) },
    },
  });
}

// Пауза специалиста завершена/удалена раньше toDate — сразу возвращает в
// расписание занятия ТЕКУЩЕГО месяца, которые были скрыты, пока пауза была
// активна (не ждёт ночную generateMonth). Диапазон намеренно ограничен
// текущим месяцем: будущие месяцы, если на момент паузы ещё не были
// сгенерированы, корректно досоздаст обычная generateMonth, когда они
// станут текущими — к тому моменту этой (уже удалённой) паузы в БД не
// будет, и её skip-проверка никого не исключит.
async function restoreSessionsAfterPauseEnd(trainerId, fromDate, toDate, { year, month } = nowYearMonth()) {
  const childId = await getChildId();
  const monthStart = dateOnly(year, month, 1);
  const monthEnd = dateOnly(year, month, daysInMonth(year, month));
  const today = todayDateOnly();

  const rangeStart = [fromDate, monthStart, today].reduce((a, b) => (a > b ? a : b));
  const rangeEnd = toDate ? (toDate < monthEnd ? toDate : monthEnd) : monthEnd;
  if (rangeStart > rangeEnd) return { created: 0 };

  const slots = (await ScheduleSlotModel.listActive()).filter((s) => s.trainerId === trainerId);
  if (slots.length === 0) return { created: 0 };

  const closedDays = await ClosedDayModel.listForMonth(year, month);
  const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));
  const pausesByTrainer = await pausesByTrainerForMonth(year, month);

  let created = 0;
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = dateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (isPausedOn(date, pausesByTrainer.get(trainerId) || [])) continue;

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
      if (existing) continue;

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

  return { created };
}

module.exports = {
  generateMonth,
  regenerateFromDate,
  hideSessionsForPause,
  restoreSessionsAfterPauseEnd,
};
