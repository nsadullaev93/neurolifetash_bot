const prisma = require('../database/connection');
const ScheduleSlotModel = require('../models/ScheduleSlot');
const ClosedDayModel = require('../models/ClosedDay');
const { getMonthDateList, isoWeekday } = require('../utils/date');
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

module.exports = { generateMonth };
