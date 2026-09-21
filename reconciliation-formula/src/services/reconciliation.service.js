'use strict';

/**
 * Формула сверки (ТЗ, п. 2.5 – 2.7).
 * Все функции чистые: на вход — данные, на выход — результат. База данных не нужна.
 */

const CONDUCTED_STATUSES = new Set(['COMPLETED', 'MAKEUP']);

const ALL_STATUSES = new Set([
  'PLANNED',
  'COMPLETED',
  'MAKEUP',
  'TRAINER_ABSENT',
  'CHILD_SICK_CERT',
  'CHILD_SICK_NO_CERT',
  'CHILD_ABSENT',
  'CLOSED_DAY',
  'RESCHEDULED',
]);

function assertNonNegativeInt(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} должно быть целым числом ≥ 0, получено: ${value}`);
  }
}

/** Идёт ли занятие в счёт проведённых. */
function countsAsConducted(status) {
  if (!ALL_STATUSES.has(status)) {
    throw new Error(`Неизвестный статус занятия: ${status}`);
  }
  return CONDUCTED_STATUSES.has(status);
}

/** Фактический специалист занятия (при подмене — тот, кто реально провёл). */
function effectiveTrainerId(session) {
  return session.actualTrainerId ?? session.plannedTrainerId;
}

/** Разбор даты 'YYYY-MM-DD' или Date в {year, month, day, weekday}, weekday: 1=Пн … 7=Вс. */
function parseDate(date) {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  const js = d.getUTCDay();
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: js === 0 ? 7 : js,
    key: d.toISOString().slice(0, 10),
  };
}

/** Количество проведённых занятий (C) у специалиста за месяц. */
function countConducted(sessions, trainerId, year, month) {
  return sessions.filter((s) => {
    const d = parseDate(s.date);
    return (
      d.year === year &&
      d.month === month &&
      effectiveTrainerId(s) === trainerId &&
      countsAsConducted(s.status)
    );
  }).length;
}

/** План по графику: дни месяца, совпадающие со слотами специалиста, минус закрытые дни. */
function calcPlan({ year, month, trainerId, slots, closedDays = [] }) {
  const closed = new Set(closedDays.map((d) => parseDate(d).key));
  const trainerSlots = slots.filter((s) => s.trainerId === trainerId && s.isActive !== false);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let plan = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const d = parseDate(new Date(Date.UTC(year, month - 1, day)));
    if (closed.has(d.key)) continue;
    plan += trainerSlots.filter((s) => s.weekday === d.weekday).length;
  }
  return plan;
}

/**
 * Баланс по одному специалисту: (P − C) × S.
 * Если с центром согласовано другое количество (agreedConducted) — деньги считаются по нему.
 */
function reconcileTrainer({
  paidSessions,
  rateSnapshot,
  conducted,
  fallbackRate,
  centerConducted,
  agreedConducted,
}) {
  assertNonNegativeInt(paidSessions, 'Оплачено занятий');
  assertNonNegativeInt(conducted, 'Проведено занятий');
  if (centerConducted != null) assertNonNegativeInt(centerConducted, 'По данным центра');
  if (agreedConducted != null) assertNonNegativeInt(agreedConducted, 'Согласовано');

  const rate = paidSessions > 0 ? rateSnapshot : rateSnapshot ?? fallbackRate;
  assertNonNegativeInt(rate, 'Ставка');

  const billable = agreedConducted ?? conducted;
  const diff = paidSessions - billable;
  const balance = diff * rate;
  const mismatch = centerConducted != null && centerConducted !== conducted;

  let direction = 'EVEN';
  if (balance > 0) direction = 'REFUND'; // центр возвращает деньгами
  if (balance < 0) direction = 'SURCHARGE'; // родитель доплачивает

  return {
    paid: paidSessions,
    conducted,
    centerConducted: centerConducted ?? null,
    agreedConducted: agreedConducted ?? null,
    mismatch,
    // спор открыт: цифры расходятся, а решение ещё не принято
    disputeOpen: mismatch && agreedConducted == null,
    diff,
    rate,
    balance,
    direction,
  };
}

/** Предупреждение о переплате (ТЗ, п. 2.6). */
function overpaymentWarning({ paidSessions, plan, rate }) {
  const extra = paidSessions - plan;
  if (extra <= 0) return null;
  return { extraSessions: extra, amount: extra * rate };
}

/**
 * Полная сверка за месяц.
 * trainers: [{ id, name, levelRate, isActive }]
 * payments: [{ trainerId, year, month, paidSessions, rateSnapshot }]
 * sessions: [{ date, plannedTrainerId, actualTrainerId?, status }]
 */
function reconcileMonth({
  year,
  month,
  trainers,
  payments,
  sessions,
  slots = [],
  closedDays = [],
  centerFigures = [], // [{ trainerId, centerConducted, agreedConducted? }]
}) {
  const rows = trainers
    .map((t) => {
      // За месяц одному специалисту может быть несколько оплат — суммируем
      const monthPayments = payments.filter(
        (p) => p.trainerId === t.id && p.year === year && p.month === month
      );
      const paidSessions = monthPayments.reduce((sum, p) => sum + p.paidSessions, 0);
      const conducted = countConducted(sessions, t.id, year, month);
      const figure = centerFigures.find((f) => f.trainerId === t.id);
      const row = reconcileTrainer({
        paidSessions,
        rateSnapshot: monthPayments.length ? monthPayments[0].rateSnapshot : undefined,
        conducted,
        fallbackRate: t.levelRate,
        centerConducted: figure?.centerConducted,
        agreedConducted: figure?.agreedConducted,
      });
      const plan = calcPlan({ year, month, trainerId: t.id, slots, closedDays });
      return {
        trainerId: t.id,
        name: t.name,
        plan,
        ...row,
        warning: overpaymentWarning({ paidSessions: row.paid, plan, rate: row.rate }),
      };
    })
    // Специалисты без оплаты и без занятий в отчёт не попадают
    .filter((r) => r.paid > 0 || r.conducted > 0);

  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  return { year, month, rows, total };
}

/** Калькулятор оплаты на месяц (ТЗ, п. 2.7). */
function forecastMonth({ year, month, trainers, slots, closedDays = [] }) {
  const rows = trainers
    .filter((t) => t.isActive !== false)
    .map((t) => {
      const plan = calcPlan({ year, month, trainerId: t.id, slots, closedDays });
      return { trainerId: t.id, name: t.name, plan, rate: t.levelRate, amount: plan * t.levelRate };
    });
  return { year, month, rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

module.exports = {
  countsAsConducted,
  effectiveTrainerId,
  countConducted,
  calcPlan,
  reconcileTrainer,
  overpaymentWarning,
  reconcileMonth,
  forecastMonth,
};
