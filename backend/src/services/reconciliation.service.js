const SessionModel = require('../models/Session');
const PaymentModel = require('../models/Payment');
const SettlementModel = require('../models/Settlement');
const { computePlanByTrainer } = require('./forecast.service');

// Core formula (see TZ v2, §2.5, §2.10, §2.12):
//   P = paidSessions (sum of all MonthlyPayment rows this month, or 0)
//   S = rateSnapshot of the FIRST payment of the month (or current level rate if none)
//   C = COUNT(COMPLETED + MAKEUP) by the EFFECTIVE trainer for the month
//   billable = agreedConducted (если центр и родитель согласовали другое число), иначе C
//   Balance = (P - billable) * S
async function calculateMonthlyReconciliation(year, month) {
  const planByTrainer = await computePlanByTrainer(year, month);
  const payments = await PaymentModel.listForMonth(year, month);
  const settlements = await SettlementModel.listForMonth(year, month);
  const settlementByTrainer = new Map(settlements.map((s) => [s.trainerId, s]));

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
    // Скидка привязана к тому же платежу, что задаёт S (первому по времени
    // в месяце) — она уже "внутри" S, здесь только для отображения флага.
    const discountApplied = hasPayment ? trainerPayments[0].discountApplied : false;
    const C = await SessionModel.countCompletedForTrainerMonth(trainer.id, year, month);

    // Сверка с цифрами центра (ТЗ v2, §2.12): пока никто не вносил цифры
    // центра, settlement для этого месяца просто не существует — mismatch
    // всегда false, а деньги считаются по собственному учёту, как раньше.
    const settlement = settlementByTrainer.get(trainer.id);
    const centerConducted = settlement?.centerConducted ?? null;
    const agreedConducted = settlement?.agreedConducted ?? null;
    const mismatch = centerConducted != null && centerConducted !== C;
    const disputeOpen = mismatch && agreedConducted == null;
    const billable = agreedConducted ?? C;
    const balance = (P - billable) * S;

    const overpayWarning = P > plan
      ? { extraSessions: P - plan, extraAmount: (P - plan) * S }
      : null;

    rows.push({
      trainerId: trainer.id,
      trainerName: trainer.name,
      levelCode: trainer.level.code,
      levelName: trainer.level.name,
      rate: S,
      discountApplied,
      plan,
      paid: P,
      completed: C,
      centerConducted,
      agreedConducted,
      mismatch,
      disputeOpen,
      balance,
      hasPayment,
      overpayWarning,
    });
  }

  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return { year, month, rows, total };
}

module.exports = { calculateMonthlyReconciliation };
