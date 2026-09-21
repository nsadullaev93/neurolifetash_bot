'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  countsAsConducted,
  countConducted,
  calcPlan,
  reconcileTrainer,
  overpaymentWarning,
  reconcileMonth,
  forecastMonth,
} = require('../src/services/reconciliation.service');
const { formatSum, formatBalance } = require('../src/utils/money');

// ---------- Тестовые данные: реальное расписание и ставки ----------

const RATE = { BEGINNER: 230000, MIDDLE: 277000, SENIOR: 380000 };

const USMON = 1;
const LI = 2;
const MISS_LIU = 3;
const LIU_HEWANG = 4;

const TRAINERS = [
  { id: USMON, name: 'Усмон', levelRate: RATE.BEGINNER },
  { id: LI, name: 'Ли', levelRate: RATE.MIDDLE },
  { id: MISS_LIU, name: 'Мисс Лю', levelRate: RATE.MIDDLE },
  { id: LIU_HEWANG, name: 'Лю Хеванг', levelRate: RATE.SENIOR },
];

// 1=Пн … 5=Пт
const SLOTS = [
  ...[1, 3, 5].map((weekday) => ({ trainerId: LIU_HEWANG, weekday, startTime: '16:00' })),
  ...[2, 4].map((weekday) => ({ trainerId: MISS_LIU, weekday, startTime: '16:00' })),
  ...[1, 2, 3, 4, 5].map((weekday) => ({ trainerId: USMON, weekday, startTime: '16:40' })),
  ...[1, 2, 3, 4, 5].map((weekday) => ({ trainerId: LI, weekday, startTime: '17:20' })),
];

/** Генерирует занятия месяца по шаблону, все со статусом status. */
function generateSessions(year, month, status = 'COMPLETED') {
  const sessions = [];
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const js = date.getUTCDay();
    const weekday = js === 0 ? 7 : js;
    for (const slot of SLOTS.filter((s) => s.weekday === weekday)) {
      sessions.push({
        date: date.toISOString().slice(0, 10),
        plannedTrainerId: slot.trainerId,
        actualTrainerId: null,
        status,
      });
    }
  }
  return sessions;
}

function payment(trainerId, paidSessions, rateSnapshot, year = 2026, month = 10) {
  return { trainerId, year, month, paidSessions, rateSnapshot };
}

const PAID_20_EACH = [
  payment(USMON, 20, RATE.BEGINNER),
  payment(LI, 20, RATE.MIDDLE),
  payment(MISS_LIU, 20, RATE.MIDDLE),
  payment(LIU_HEWANG, 20, RATE.SENIOR),
];

// ======================================================================

describe('Статусы занятий', () => {
  it('в счёт идут только COMPLETED и MAKEUP', () => {
    assert.equal(countsAsConducted('COMPLETED'), true);
    assert.equal(countsAsConducted('MAKEUP'), true);
  });

  it('все причины пропуска НЕ идут в счёт (деньги возвращаются)', () => {
    for (const s of [
      'PLANNED',
      'TRAINER_ABSENT',
      'CHILD_SICK_CERT',
      'CHILD_SICK_NO_CERT',
      'CHILD_ABSENT',
      'CLOSED_DAY',
      'RESCHEDULED',
    ]) {
      assert.equal(countsAsConducted(s), false, `статус ${s}`);
    }
  });

  it('неизвестный статус вызывает ошибку', () => {
    assert.throws(() => countsAsConducted('DONE'), /Неизвестный статус/);
  });
});

describe('План по графику', () => {
  it('октябрь 2026: 22 / 22 / 9 / 13', () => {
    const p = (id) => calcPlan({ year: 2026, month: 10, trainerId: id, slots: SLOTS });
    assert.equal(p(USMON), 22);
    assert.equal(p(LI), 22);
    assert.equal(p(MISS_LIU), 9);
    assert.equal(p(LIU_HEWANG), 13);
  });

  it('ноябрь 2026: 21 / 21 / 8 / 13', () => {
    const p = (id) => calcPlan({ year: 2026, month: 11, trainerId: id, slots: SLOTS });
    assert.equal(p(USMON), 21);
    assert.equal(p(LI), 21);
    assert.equal(p(MISS_LIU), 8);
    assert.equal(p(LIU_HEWANG), 13);
  });

  it('закрытый будний день уменьшает план', () => {
    // 2026-10-05 — понедельник: минус 1 у Усмона, Ли и Лю Хеванг, Мисс Лю не затронута
    const closedDays = ['2026-10-05'];
    const p = (id) => calcPlan({ year: 2026, month: 10, trainerId: id, slots: SLOTS, closedDays });
    assert.equal(p(USMON), 21);
    assert.equal(p(LI), 21);
    assert.equal(p(LIU_HEWANG), 12);
    assert.equal(p(MISS_LIU), 9);
  });

  it('закрытый день в выходные план не меняет', () => {
    const closedDays = ['2026-10-03']; // суббота
    assert.equal(calcPlan({ year: 2026, month: 10, trainerId: USMON, slots: SLOTS, closedDays }), 22);
  });

  it('неактивный слот не учитывается', () => {
    const slots = SLOTS.map((s) =>
      s.trainerId === LIU_HEWANG && s.weekday === 5 ? { ...s, isActive: false } : s
    );
    // без пятниц: 4 Пн + 4 Ср = 8
    assert.equal(calcPlan({ year: 2026, month: 10, trainerId: LIU_HEWANG, slots }), 8);
  });
});

describe('Баланс по одному специалисту: (P − C) × S', () => {
  it('проведено меньше — возврат', () => {
    const r = reconcileTrainer({ paidSessions: 20, rateSnapshot: 380000, conducted: 13 });
    assert.equal(r.diff, 7);
    assert.equal(r.balance, 2660000);
    assert.equal(r.direction, 'REFUND');
  });

  it('проведено больше — доплата', () => {
    const r = reconcileTrainer({ paidSessions: 20, rateSnapshot: 230000, conducted: 22 });
    assert.equal(r.diff, -2);
    assert.equal(r.balance, -460000);
    assert.equal(r.direction, 'SURCHARGE');
  });

  it('совпало — ноль', () => {
    const r = reconcileTrainer({ paidSessions: 20, rateSnapshot: 277000, conducted: 20 });
    assert.equal(r.balance, 0);
    assert.equal(r.direction, 'EVEN');
  });

  it('ни одного занятия — возврат всей суммы', () => {
    const r = reconcileTrainer({ paidSessions: 20, rateSnapshot: 277000, conducted: 0 });
    assert.equal(r.balance, 5540000);
  });

  it('оплаты нет (P = 0) — доплата по текущей ставке уровня', () => {
    const r = reconcileTrainer({ paidSessions: 0, conducted: 2, fallbackRate: 277000 });
    assert.equal(r.rate, 277000);
    assert.equal(r.balance, -554000);
  });

  it('используется ставка-снимок, а не текущая ставка уровня', () => {
    const r = reconcileTrainer({
      paidSessions: 20,
      rateSnapshot: 380000,
      conducted: 19,
      fallbackRate: 400000, // ставку позже подняли — прошлый месяц не меняется
    });
    assert.equal(r.balance, 380000);
  });

  it('некорректные входные данные вызывают ошибку', () => {
    assert.throws(() => reconcileTrainer({ paidSessions: -1, rateSnapshot: 1, conducted: 0 }));
    assert.throws(() => reconcileTrainer({ paidSessions: 2.5, rateSnapshot: 1, conducted: 0 }));
    assert.throws(() => reconcileTrainer({ paidSessions: 1, rateSnapshot: 1, conducted: -3 }));
    assert.throws(() => reconcileTrainer({ paidSessions: 0, conducted: 1 })); // нет ставки вообще
  });
});

describe('Контрольный пример из ТЗ (п. 2.8): октябрь 2026, оплачено по 20', () => {
  const report = reconcileMonth({
    year: 2026,
    month: 10,
    trainers: TRAINERS,
    payments: PAID_20_EACH,
    sessions: generateSessions(2026, 10),
    slots: SLOTS,
  });
  const row = (id) => report.rows.find((r) => r.trainerId === id);

  it('Усмон: −460 000', () => assert.equal(row(USMON).balance, -460000));
  it('Ли: −554 000', () => assert.equal(row(LI).balance, -554000));
  it('Мисс Лю: +3 047 000', () => assert.equal(row(MISS_LIU).balance, 3047000));
  it('Лю Хеванг: +2 660 000', () => assert.equal(row(LIU_HEWANG).balance, 2660000));
  it('итого: +4 693 000', () => assert.equal(report.total, 4693000));

  it('предупреждение о переплате у Мисс Лю и Лю Хеванг', () => {
    assert.deepEqual(row(MISS_LIU).warning, { extraSessions: 11, amount: 3047000 });
    assert.deepEqual(row(LIU_HEWANG).warning, { extraSessions: 7, amount: 2660000 });
    assert.equal(row(USMON).warning, null);
    assert.equal(row(LI).warning, null);
  });
});

describe('Пропуски, отработки, подмены', () => {
  it('пропуски по любой причине увеличивают возврат', () => {
    const sessions = generateSessions(2026, 10);
    const usmon = sessions.filter((s) => s.plannedTrainerId === USMON);
    usmon[0].status = 'TRAINER_ABSENT';
    usmon[1].status = 'CHILD_SICK_NO_CERT';
    usmon[2].status = 'CLOSED_DAY';

    const r = reconcileMonth({
      year: 2026, month: 10, trainers: TRAINERS, payments: PAID_20_EACH, sessions,
    }).rows.find((x) => x.trainerId === USMON);

    assert.equal(r.conducted, 19);
    assert.equal(r.balance, 230000); // 20 − 19 = 1 занятие в пользу родителя
  });

  it('перенос + отработка по деньгам нейтральны', () => {
    const sessions = [
      { date: '2026-10-05', plannedTrainerId: LI, status: 'RESCHEDULED' },
      { date: '2026-10-10', plannedTrainerId: LI, status: 'MAKEUP' },
      { date: '2026-10-06', plannedTrainerId: LI, status: 'COMPLETED' },
    ];
    assert.equal(countConducted(sessions, LI, 2026, 10), 2);
  });

  it('подмена: занятие засчитывается фактическому специалисту по его ставке', () => {
    const sessions = [
      { date: '2026-10-05', plannedTrainerId: USMON, actualTrainerId: LI, status: 'COMPLETED' },
    ];
    const report = reconcileMonth({
      year: 2026,
      month: 10,
      trainers: TRAINERS,
      payments: [payment(USMON, 1, RATE.BEGINNER)],
      sessions,
    });
    const usmon = report.rows.find((r) => r.trainerId === USMON);
    const li = report.rows.find((r) => r.trainerId === LI);

    assert.equal(usmon.conducted, 0);
    assert.equal(usmon.balance, 230000); // оплаченное Усмону возвращается
    assert.equal(li.conducted, 1);
    assert.equal(li.balance, -277000); // доплата Ли по ставке среднего
    assert.equal(report.total, -47000);
  });

  it('занятия другого месяца не учитываются', () => {
    const sessions = [
      { date: '2026-09-30', plannedTrainerId: LI, status: 'COMPLETED' },
      { date: '2026-10-01', plannedTrainerId: LI, status: 'COMPLETED' },
      { date: '2026-11-01', plannedTrainerId: LI, status: 'COMPLETED' },
    ];
    assert.equal(countConducted(sessions, LI, 2026, 10), 1);
  });

  it('оплата другого месяца не учитывается', () => {
    const report = reconcileMonth({
      year: 2026,
      month: 10,
      trainers: TRAINERS,
      payments: [payment(LI, 20, RATE.MIDDLE, 2026, 9)],
      sessions: [{ date: '2026-10-01', plannedTrainerId: LI, status: 'COMPLETED' }],
    });
    assert.equal(report.rows.find((r) => r.trainerId === LI).balance, -277000);
  });

  it('несколько оплат одному специалисту за месяц суммируются', () => {
    const report = reconcileMonth({
      year: 2026,
      month: 10,
      trainers: TRAINERS,
      payments: [payment(LIU_HEWANG, 8, RATE.SENIOR), payment(LIU_HEWANG, 5, RATE.SENIOR)],
      sessions: generateSessions(2026, 10),
    });
    const r = report.rows.find((x) => x.trainerId === LIU_HEWANG);
    assert.equal(r.paid, 13);
    assert.equal(r.balance, 0);
  });

  it('специалист без оплаты и без занятий в отчёт не попадает', () => {
    const report = reconcileMonth({
      year: 2026, month: 10, trainers: TRAINERS,
      payments: [payment(LI, 1, RATE.MIDDLE)], sessions: [],
    });
    assert.deepEqual(report.rows.map((r) => r.trainerId), [LI]);
  });
});

describe('Сравнение с цифрами центра', () => {
  const base = { paidSessions: 20, rateSnapshot: 277000, conducted: 21 };

  it('цифры совпали — расхождения нет', () => {
    const r = reconcileTrainer({ ...base, centerConducted: 21 });
    assert.equal(r.mismatch, false);
    assert.equal(r.disputeOpen, false);
    assert.equal(r.balance, -277000);
  });

  it('цифры разошлись — спор открыт, деньги пока по нашему учёту', () => {
    const r = reconcileTrainer({ ...base, centerConducted: 22 });
    assert.equal(r.mismatch, true);
    assert.equal(r.disputeOpen, true);
    assert.equal(r.balance, -277000);
  });

  it('приняли цифру центра — деньги по согласованному', () => {
    const r = reconcileTrainer({ ...base, centerConducted: 22, agreedConducted: 22 });
    assert.equal(r.disputeOpen, false);
    assert.equal(r.balance, -554000);
  });

  it('оставили свою цифру — деньги по нашему учёту, спор закрыт', () => {
    const r = reconcileTrainer({ ...base, centerConducted: 22, agreedConducted: 21 });
    assert.equal(r.disputeOpen, false);
    assert.equal(r.balance, -277000);
  });

  it('цифры центра передаются в месячную сверку', () => {
    const report = reconcileMonth({
      year: 2026,
      month: 10,
      trainers: TRAINERS,
      payments: PAID_20_EACH,
      sessions: generateSessions(2026, 10),
      centerFigures: [{ trainerId: LI, centerConducted: 21 }],
    });
    const li = report.rows.find((r) => r.trainerId === LI);
    const usmon = report.rows.find((r) => r.trainerId === USMON);
    assert.equal(li.mismatch, true);
    assert.equal(li.centerConducted, 21);
    assert.equal(usmon.centerConducted, null);
    assert.equal(usmon.mismatch, false);
  });

  it('некорректная цифра центра вызывает ошибку', () => {
    assert.throws(() => reconcileTrainer({ ...base, centerConducted: -1 }));
  });
});

describe('Предупреждение о переплате', () => {
  it('нет предупреждения, если оплачено не больше плана', () => {
    assert.equal(overpaymentWarning({ paidSessions: 22, plan: 22, rate: 1 }), null);
    assert.equal(overpaymentWarning({ paidSessions: 20, plan: 22, rate: 1 }), null);
  });
});

describe('Калькулятор оплаты на месяц (п. 2.7)', () => {
  it('октябрь 2026: итого 18 587 000', () => {
    const f = forecastMonth({ year: 2026, month: 10, trainers: TRAINERS, slots: SLOTS });
    const amount = (id) => f.rows.find((r) => r.trainerId === id).amount;
    assert.equal(amount(USMON), 5060000);
    assert.equal(amount(LI), 6094000);
    assert.equal(amount(MISS_LIU), 2493000);
    assert.equal(amount(LIU_HEWANG), 4940000);
    assert.equal(f.total, 18587000);
  });

  it('ноябрь 2026: итого 17 803 000', () => {
    const f = forecastMonth({ year: 2026, month: 11, trainers: TRAINERS, slots: SLOTS });
    const amount = (id) => f.rows.find((r) => r.trainerId === id).amount;
    assert.equal(amount(USMON), 4830000);
    assert.equal(amount(LI), 5817000);
    assert.equal(amount(MISS_LIU), 2216000);
    assert.equal(amount(LIU_HEWANG), 4940000);
    assert.equal(f.total, 17803000);
  });

  it('неактивный специалист в расчёт не попадает', () => {
    const trainers = TRAINERS.map((t) => (t.id === MISS_LIU ? { ...t, isActive: false } : t));
    const f = forecastMonth({ year: 2026, month: 10, trainers, slots: SLOTS });
    assert.equal(f.rows.length, 3);
    assert.equal(f.total, 18587000 - 2493000);
  });

  it('прогноз совпадает с фактом, если всё проведено и оплачено по плану', () => {
    const payments = TRAINERS.map((t) =>
      payment(t.id, calcPlan({ year: 2026, month: 10, trainerId: t.id, slots: SLOTS }), t.levelRate)
    );
    const report = reconcileMonth({
      year: 2026, month: 10, trainers: TRAINERS, payments,
      sessions: generateSessions(2026, 10), slots: SLOTS,
    });
    assert.equal(report.total, 0);
    assert.ok(report.rows.every((r) => r.warning === null));
  });
});

describe('Форматирование сумм', () => {
  it('разделители тысяч и валюта', () => {
    assert.equal(formatSum(4830000), '4 830 000 сум');
    assert.equal(formatSum(230000), '230 000 сум');
    assert.equal(formatSum(0), '0 сум');
  });

  it('знак баланса', () => {
    assert.equal(formatBalance(2660000), '+2 660 000 сум');
    assert.equal(formatBalance(-460000), '−460 000 сум');
    assert.equal(formatBalance(0), '0 сум');
  });
});
