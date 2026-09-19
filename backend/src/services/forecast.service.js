const TrainerModel = require('../models/Trainer');
const ClosedDayModel = require('../models/ClosedDay');
const { getMonthDateList, isoWeekday } = require('../utils/date');

// Plan = number of (day, slot) matches from the schedule template in the
// given month, excluding closed days. This is the "план по графику" used
// both by the payment calculator (2.7) and the reconciliation warning (2.6).
async function computePlanByTrainer(year, month) {
  const trainers = await TrainerModel.listAll({ onlyActive: true });
  const closedDays = await ClosedDayModel.listForMonth(year, month);
  const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));
  const monthDates = getMonthDateList(year, month);

  return trainers.map((trainer) => {
    const activeSlots = trainer.slots.filter((s) => s.isActive);
    let plan = 0;

    for (const date of monthDates) {
      const key = date.toISOString().slice(0, 10);
      if (closedSet.has(key)) continue;
      const weekday = isoWeekday(date);
      plan += activeSlots.filter((s) => s.weekday === weekday).length;
    }

    return { trainer, plan };
  });
}

async function calculateForecast(year, month) {
  const planByTrainer = await computePlanByTrainer(year, month);

  const breakdown = planByTrainer.map(({ trainer, plan }) => {
    const rate = trainer.level.rate;
    const amount = plan * rate;
    return {
      trainerId: trainer.id,
      trainerName: trainer.name,
      levelCode: trainer.level.code,
      levelName: trainer.level.name,
      rate,
      plan,
      amount,
    };
  });

  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);

  return { year, month, breakdown, total };
}

module.exports = { computePlanByTrainer, calculateForecast };
