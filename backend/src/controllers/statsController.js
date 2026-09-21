const { getPeriodStats, getMonthlyTrend } = require('../services/stats.service');
const { nowYearMonth, prevMonthOf } = require('../utils/date');

// Проценты посещаемости видят все члены семьи, денежные показатели —
// только те, кому открыты деньги (ТЗ v2, §2.16).
function stripMoney(stats) {
  const strip = (row) => {
    const { valueConducted, cashPaid, ...rest } = row;
    return rest;
  };
  return {
    ...stats,
    rows: stats.rows.map(strip),
    total: strip(stats.total),
  };
}

function stripMoneyTrend(trend) {
  return trend.map(({ valueConducted, ...rest }) => rest);
}

function monthsBack(count) {
  const { year, month } = nowYearMonth();
  let y = year;
  let m = month;
  for (let i = 1; i < count; i++) {
    ({ year: y, month: m } = prevMonthOf(y, m));
  }
  return { from: { year: y, month: m }, to: { year, month } };
}

function parsePeriod(req) {
  const { from, to, period } = req.query;
  if (from && to) {
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    return { from: { year: fy, month: fm }, to: { year: ty, month: tm } };
  }
  const counts = { '3m': 3, '6m': 6, '1y': 12 };
  if (period === 'all') {
    return { from: { year: 2020, month: 1 }, to: nowYearMonth() };
  }
  return monthsBack(counts[period] || 3);
}

async function stats(req, res, next) {
  try {
    const { from, to } = parsePeriod(req);
    const result = await getPeriodStats(from, to);
    res.json(req.member?.canSeeMoney ? result : stripMoney(result));
  } catch (err) {
    next(err);
  }
}

async function trend(req, res, next) {
  try {
    const { from, to } = parsePeriod(req);
    const result = await getMonthlyTrend(from, to);
    res.json(req.member?.canSeeMoney ? result : stripMoneyTrend(result));
  } catch (err) {
    next(err);
  }
}

module.exports = { stats, trend };
