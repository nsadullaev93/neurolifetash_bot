const TrainerModel = require('../models/Trainer');
const ClosedDayModel = require('../models/ClosedDay');
const SettlementModel = require('../models/Settlement');
const PaymentModel = require('../models/Payment');
const { getMonthDateList, isoWeekday, prevMonthOf } = require('../utils/date');

// Перенесённые расчёты ПРЕДЫДУЩЕГО месяца (ТЗ v2, §2.7, §2.9). Переплата
// (balance > 0) уменьшает "к оплате", доплата, которую решили добавить
// (balance < 0, статус CARRIED_OVER) — увеличивает. Знак уже заложен в
// самом balance, поэтому формула для обоих случаев одна:
// к_оплате = сумма − balance.
async function getCarryAdjustments(year, month) {
  const { year: prevYear, month: prevM } = prevMonthOf(year, month);
  const settlements = await SettlementModel.listForMonth(prevYear, prevM);
  const byTrainer = new Map();
  for (const s of settlements) {
    if (s.status === 'CARRIED_OVER') byTrainer.set(s.trainerId, s.balance);
  }
  return byTrainer;
}

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
  const carryAdjustments = await getCarryAdjustments(year, month);

  const breakdown = planByTrainer.map(({ trainer, plan }) => {
    const rate = trainer.level.rate;
    const grossAmount = plan * rate;
    const carryBalance = carryAdjustments.get(trainer.id) ?? 0;
    const amount = grossAmount - carryBalance;
    return {
      trainerId: trainer.id,
      trainerName: trainer.name,
      levelCode: trainer.level.code,
      levelName: trainer.level.name,
      rate,
      plan,
      grossAmount,
      carryBalance,
      amount,
    };
  });

  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);

  return { year, month, breakdown, total };
}

// Статус оплаты специалиста за месяц (ТЗ v2, §2.10) — вычисляется, не
// хранится: сравнивает фактически внесённое (сумма всех MonthlyPayment за
// месяц) с "к оплате" из калькулятора (уже с учётом переноса, §2.7/§2.9).
async function calculatePaymentStatus(year, month) {
  const forecast = await calculateForecast(year, month);
  const payments = await PaymentModel.listForMonth(year, month);

  const paidByTrainer = new Map();
  for (const p of payments) {
    paidByTrainer.set(p.trainerId, (paidByTrainer.get(p.trainerId) || 0) + p.totalAmount);
  }

  const rows = forecast.breakdown.map((b) => {
    const paidAmount = paidByTrainer.get(b.trainerId) || 0;
    let status = 'PAID';
    if (paidAmount === 0) status = 'UNPAID';
    else if (paidAmount < b.amount) status = 'PARTIAL';
    return {
      trainerId: b.trainerId,
      trainerName: b.trainerName,
      toPay: b.amount,
      paidAmount,
      remaining: Math.max(b.amount - paidAmount, 0),
      status,
    };
  });

  return { year, month, rows };
}

module.exports = { computePlanByTrainer, calculateForecast, calculatePaymentStatus };
