'use strict';

// Вендорная копия чистых функций из reconciliation-formula/src/services/stats.service.js
// (ТЗ v2, §2.16) — не менять руками, обновлять вместе с эталонным пакетом.
// Держится отдельно от backend/, а не через require('../../../reconciliation-formula/...'),
// потому что Render деплоит backend/ с Root Directory=backend — соседняя папка
// репозитория на рантайме недоступна.

const CONDUCTED = new Set(['COMPLETED', 'MAKEUP']);
const CHILD_REASONS = new Set(['CHILD_SICK_CERT', 'CHILD_SICK_NO_CERT', 'CHILD_ABSENT']);
// Не учитываются в процентах: день закрыт или занятие ещё не отмечено
const EXCLUDED = new Set(['CLOSED_DAY', 'PLANNED']);

function monthIndex(year, month) {
  return year * 12 + (month - 1);
}

function inPeriod(dateStr, from, to) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const idx = monthIndex(d.getUTCFullYear(), d.getUTCMonth() + 1);
  return idx >= monthIndex(from.year, from.month) && idx <= monthIndex(to.year, to.month);
}

function ymInPeriod(year, month, from, to) {
  const idx = monthIndex(year, month);
  return idx >= monthIndex(from.year, from.month) && idx <= monthIndex(to.year, to.month);
}

/** Доля с защитой от деления на ноль; null — «нет данных». */
function ratio(part, total) {
  return total === 0 ? null : part / total;
}

/**
 * trainers:    [{ id, name, levelRate }]
 * sessions:    [{ date, plannedTrainerId, actualTrainerId?, status }]
 * payments:    [{ trainerId, year, month, paidSessions, rateSnapshot, totalAmount }]
 * settlements: [{ trainerId, year, month, status, paidAmount? }]
 */
function periodStats({ from, to, trainers, sessions, payments = [], settlements = [] }) {
  if (monthIndex(from.year, from.month) > monthIndex(to.year, to.month)) {
    throw new Error('Начало периода позже конца');
  }

  const periodSessions = sessions.filter((s) => inPeriod(s.date, from, to));

  const rows = trainers.map((t) => {
    // По плановому специалисту: надёжность и посещаемость
    const own = periodSessions.filter((s) => s.plannedTrainerId === t.id && !EXCLUDED.has(s.status));
    const trainerAbsent = own.filter((s) => s.status === 'TRAINER_ABSENT').length;
    const childMissed = own.filter((s) => CHILD_REASONS.has(s.status)).length;
    const rescheduled = own.filter((s) => s.status === 'RESCHEDULED').length;
    const held = own.filter((s) => CONDUCTED.has(s.status)).length;

    // По фактическому специалисту: сколько реально провёл (включая подмены)
    const conducted = periodSessions.filter(
      (s) => (s.actualTrainerId ?? s.plannedTrainerId) === t.id && CONDUCTED.has(s.status)
    );

    // Стоимость проведённых: ставка-снимок месяца, иначе текущая ставка уровня
    const value = conducted.reduce((sum, s) => {
      const d = new Date(`${s.date}T00:00:00Z`);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const p = payments.find((x) => x.trainerId === t.id && x.year === y && x.month === m);
      return sum + (p ? p.rateSnapshot : t.levelRate);
    }, 0);

    const paidByPayments = payments
      .filter((p) => p.trainerId === t.id && ymInPeriod(p.year, p.month, from, to))
      .reduce((sum, p) => sum + p.totalAmount, 0);
    const paidSeparately = settlements
      .filter(
        (x) =>
          x.trainerId === t.id &&
          x.status === 'PAID_SEPARATELY' &&
          ymInPeriod(x.year, x.month, from, to)
      )
      .reduce((sum, x) => sum + (x.paidAmount || 0), 0);

    return {
      trainerId: t.id,
      name: t.name,
      scheduled: own.length,
      held,
      conducted: conducted.length,
      trainerAbsent,
      childMissed,
      rescheduled,
      attendanceRate: ratio(held, own.length), // доля состоявшихся занятий
      reliability: own.length === 0 ? null : 1 - trainerAbsent / own.length, // специалист на месте
      valueConducted: value,
      cashPaid: paidByPayments + paidSeparately,
    };
  });

  const sum = (key) => rows.reduce((acc, r) => acc + r[key], 0);
  const scheduled = sum('scheduled');

  return {
    from,
    to,
    rows,
    total: {
      scheduled,
      held: sum('held'),
      trainerAbsent: sum('trainerAbsent'),
      childMissed: sum('childMissed'),
      attendanceRate: ratio(sum('held'), scheduled),
      valueConducted: sum('valueConducted'),
      cashPaid: sum('cashPaid'),
    },
  };
}

/** Помесячная разбивка для графика: [{ year, month, held, valueConducted }] */
function monthlyTrend({ from, to, trainers, sessions, payments = [] }) {
  const result = [];
  let idx = monthIndex(from.year, from.month);
  const end = monthIndex(to.year, to.month);
  while (idx <= end) {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const s = periodStats({ from: { year, month }, to: { year, month }, trainers, sessions, payments });
    result.push({ year, month, held: s.total.held, valueConducted: s.total.valueConducted });
    idx++;
  }
  return result;
}

module.exports = { periodStats, monthlyTrend };
