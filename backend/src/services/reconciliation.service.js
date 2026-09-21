const SessionModel = require('../models/Session');
const PaymentModel = require('../models/Payment');
const { computePlanByTrainer } = require('./forecast.service');

// Core formula (see TZ 2.5):
//   P = paidSessions (from MonthlyPayment, or 0 if no payment yet)
//   S = rateSnapshot (from MonthlyPayment, or current level rate if no payment)
//   C = COUNT(COMPLETED + MAKEUP) by the EFFECTIVE trainer for the month
//   Balance = (P - C) * S
async function calculateMonthlyReconciliation(year, month) {
  const planByTrainer = await computePlanByTrainer(year, month);
  const payments = await PaymentModel.listForMonth(year, month);

  // За месяц одному специалисту может быть несколько оплат (ТЗ v2, §2.10):
  // P — их сумма, S — ставка-снимок ПЕРВОЙ по времени оплаты месяца.
  const paymentsByTrainer = new Map();
  for (const p of payments) {
    if (!paymentsByTrainer.has(p.trainerId)) paymentsByTrainer.set(p.trainerId, []);
    paymentsByTrainer.get(p.trainerId).push(p);
  }
  for (const list of paymentsByTrainer.values()) {
    list.sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));
  }

  const rows = [];
  for (const { trainer, plan } of planByTrainer) {
    const trainerPayments = paymentsByTrainer.get(trainer.id) || [];
    const hasPayment = trainerPayments.length > 0;
    const P = trainerPayments.reduce((sum, p) => sum + p.paidSessions, 0);
    const S = hasPayment ? trainerPayments[0].rateSnapshot : trainer.level.rate;
    const C = await SessionModel.countCompletedForTrainerMonth(trainer.id, year, month);
    const balance = (P - C) * S;

    const overpayWarning = P > plan
      ? { extraSessions: P - plan, extraAmount: (P - plan) * S }
      : null;

    rows.push({
      trainerId: trainer.id,
      trainerName: trainer.name,
      levelCode: trainer.level.code,
      levelName: trainer.level.name,
      rate: S,
      plan,
      paid: P,
      completed: C,
      balance,
      hasPayment,
      overpayWarning,
    });
  }

  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return { year, month, rows, total };
}

module.exports = { calculateMonthlyReconciliation };
