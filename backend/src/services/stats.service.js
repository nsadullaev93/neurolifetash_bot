const TrainerModel = require('../models/Trainer');
const PaymentModel = require('../models/Payment');
const SettlementModel = require('../models/Settlement');
const SessionModel = require('../models/Session');
const { dateOnly, daysInMonth } = require('../utils/date');
const { periodStats, monthlyTrend } = require('./statsFormula');

function toDateStr(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function monthIndex(year, month) {
  return year * 12 + (month - 1);
}

async function loadInputs(from, to) {
  const trainers = await TrainerModel.listAll();
  const trainerRows = trainers.map((t) => ({ id: t.id, name: t.name, levelRate: t.level.rate }));

  const fromDate = dateOnly(from.year, from.month, 1);
  const toDate = dateOnly(to.year, to.month, daysInMonth(to.year, to.month));
  const rawSessions = await SessionModel.listBetween(fromDate, toDate);
  const sessions = rawSessions.map((s) => ({
    date: toDateStr(s.date),
    plannedTrainerId: s.plannedTrainerId,
    actualTrainerId: s.actualTrainerId,
    status: s.status,
  }));

  // Небольшой объём данных (одна семья) — проще отфильтровать по периоду в
  // JS, чем заводить отдельный диапазонный запрос в модели.
  const allPayments = await PaymentModel.listAll();
  const payments = allPayments
    .filter((p) => monthIndex(p.year, p.month) >= monthIndex(from.year, from.month))
    .filter((p) => monthIndex(p.year, p.month) <= monthIndex(to.year, to.month))
    .map((p) => ({
      trainerId: p.trainerId,
      year: p.year,
      month: p.month,
      paidSessions: p.paidSessions,
      rateSnapshot: p.rateSnapshot,
      totalAmount: p.totalAmount,
    }));

  const allSettlements = await SettlementModel.listAll();
  const settlements = allSettlements
    .filter((s) => monthIndex(s.year, s.month) >= monthIndex(from.year, from.month))
    .filter((s) => monthIndex(s.year, s.month) <= monthIndex(to.year, to.month))
    .map((s) => ({
      trainerId: s.trainerId,
      year: s.year,
      month: s.month,
      status: s.status,
      paidAmount: s.paidAmount,
    }));

  return { trainers: trainerRows, sessions, payments, settlements };
}

async function getPeriodStats(from, to) {
  const { trainers, sessions, payments, settlements } = await loadInputs(from, to);
  return periodStats({ from, to, trainers, sessions, payments, settlements });
}

async function getMonthlyTrend(from, to) {
  const { trainers, sessions, payments } = await loadInputs(from, to);
  return monthlyTrend({ from, to, trainers, sessions, payments });
}

module.exports = { getPeriodStats, getMonthlyTrend };
