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
  const paymentByTrainer = new Map(payments.map((p) => [p.trainerId, p]));

  const rows = [];
  for (const { trainer, plan } of planByTrainer) {
    const payment = paymentByTrainer.get(trainer.id);
    const P = payment ? payment.paidSessions : 0;
    const S = payment ? payment.rateSnapshot : trainer.level.rate;
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
      hasPayment: !!payment,
      overpayWarning,
    });
  }

  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return { year, month, rows, total };
}

module.exports = { calculateMonthlyReconciliation };
