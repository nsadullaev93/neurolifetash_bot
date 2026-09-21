'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { periodStats, monthlyTrend } = require('../src/services/stats.service');

const USMON = 1;
const LI = 2;
const TRAINERS = [
  { id: USMON, name: 'Усмон', levelRate: 230000 },
  { id: LI, name: 'Ли', levelRate: 277000 },
];
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

function s(date, trainerId, status, actualTrainerId = null) {
  return { date, plannedTrainerId: trainerId, actualTrainerId, status };
}

describe('Статистика за период', () => {
  const sessions = [
    s('2026-10-01', USMON, 'COMPLETED'),
    s('2026-10-02', USMON, 'COMPLETED'),
    s('2026-10-05', USMON, 'TRAINER_ABSENT'),
    s('2026-10-06', USMON, 'CHILD_SICK_CERT'),
    s('2026-10-07', USMON, 'CLOSED_DAY'), // не учитывается
    s('2026-10-30', USMON, 'PLANNED'), // не отмечено — не учитывается
    s('2026-11-02', USMON, 'COMPLETED'),
  ];

  it('посещаемость и надёжность считаются без закрытых и неотмеченных дней', () => {
    const r = periodStats({ from: OCT, to: OCT, trainers: TRAINERS, sessions }).rows[0];
    assert.equal(r.scheduled, 4);
    assert.equal(r.held, 2);
    assert.equal(r.trainerAbsent, 1);
    assert.equal(r.childMissed, 1);
    assert.equal(r.attendanceRate, 0.5);
    assert.equal(r.reliability, 0.75);
  });

  it('период из нескольких месяцев включает все месяцы', () => {
    const r = periodStats({ from: OCT, to: NOV, trainers: TRAINERS, sessions }).rows[0];
    assert.equal(r.held, 3);
    assert.equal(r.scheduled, 5);
  });

  it('нет занятий — проценты null, а не ошибка деления', () => {
    const r = periodStats({ from: OCT, to: OCT, trainers: TRAINERS, sessions }).rows[1];
    assert.equal(r.attendanceRate, null);
    assert.equal(r.reliability, null);
  });

  it('подмена: проведённое занятие засчитывается фактическому, пропуск — нет', () => {
    const r = periodStats({
      from: OCT,
      to: OCT,
      trainers: TRAINERS,
      sessions: [s('2026-10-01', USMON, 'COMPLETED', LI)],
    }).rows;
    assert.equal(r[0].held, 1); // по плану занятие Усмона состоялось
    assert.equal(r[0].conducted, 0); // но провёл не он
    assert.equal(r[1].conducted, 1);
    assert.equal(r[1].valueConducted, 277000);
  });

  it('стоимость проведённых по ставке-снимку, иначе по ставке уровня', () => {
    const r = periodStats({
      from: OCT,
      to: NOV,
      trainers: TRAINERS,
      sessions,
      payments: [{ trainerId: USMON, year: 2026, month: 10, paidSessions: 20, rateSnapshot: 200000, totalAmount: 4000000 }],
    }).rows[0];
    // 2 в октябре по 200 000 + 1 в ноябре по 230 000
    assert.equal(r.valueConducted, 630000);
  });

  it('внесено денег: оплаты + доплаты отдельно', () => {
    const r = periodStats({
      from: OCT,
      to: NOV,
      trainers: TRAINERS,
      sessions: [],
      payments: [
        { trainerId: USMON, year: 2026, month: 10, paidSessions: 20, rateSnapshot: 230000, totalAmount: 4600000 },
        { trainerId: USMON, year: 2026, month: 12, paidSessions: 20, rateSnapshot: 230000, totalAmount: 4600000 }, // вне периода
      ],
      settlements: [
        { trainerId: USMON, year: 2026, month: 10, status: 'PAID_SEPARATELY', paidAmount: 460000 },
        { trainerId: USMON, year: 2026, month: 11, status: 'CARRIED_OVER', paidAmount: 999 }, // не считается
      ],
    }).rows[0];
    assert.equal(r.cashPaid, 5060000);
  });

  it('итоги по всем специалистам', () => {
    const st = periodStats({
      from: OCT,
      to: OCT,
      trainers: TRAINERS,
      sessions: [...sessions, s('2026-10-01', LI, 'COMPLETED'), s('2026-10-02', LI, 'TRAINER_ABSENT')],
    });
    assert.equal(st.total.scheduled, 6);
    assert.equal(st.total.held, 3);
    assert.equal(st.total.attendanceRate, 0.5);
    assert.equal(st.total.trainerAbsent, 2);
  });

  it('начало периода позже конца — ошибка', () => {
    assert.throws(() => periodStats({ from: NOV, to: OCT, trainers: TRAINERS, sessions }));
  });
});

describe('Помесячная динамика', () => {
  it('по месяцу на каждый месяц периода, включая переход через год', () => {
    const trend = monthlyTrend({
      from: { year: 2026, month: 11 },
      to: { year: 2027, month: 2 },
      trainers: TRAINERS,
      sessions: [s('2026-12-01', LI, 'COMPLETED'), s('2027-01-05', LI, 'COMPLETED')],
    });
    assert.deepEqual(
      trend.map((m) => [m.year, m.month, m.held]),
      [[2026, 11, 0], [2026, 12, 1], [2027, 1, 1], [2027, 2, 0]]
    );
    assert.equal(trend[1].valueConducted, 277000);
  });
});
