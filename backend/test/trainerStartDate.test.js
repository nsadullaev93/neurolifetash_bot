// Специалист-замена с середины месяца (Ван, с 20.10.2026): план по графику
// раньше считался за весь месяц — 21 занятие вместо 9 (21.10.2026).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isBeforeStart } = require('../src/utils/trainerPause');
const { planForTrainer } = require('../src/services/forecast.service');
const { getMonthDateList } = require('../src/utils/date');

test('isBeforeStart — без startDate специалист работает всегда', () => {
  assert.equal(isBeforeStart(new Date('2026-10-01T00:00:00Z'), { startDate: null }), false);
});

test('isBeforeStart — дни до startDate исключаются, сам день начала — нет', () => {
  const trainer = { startDate: new Date('2026-10-20T00:00:00Z') };
  assert.equal(isBeforeStart(new Date('2026-10-19T00:00:00Z'), trainer), true);
  assert.equal(isBeforeStart(new Date('2026-10-20T00:00:00Z'), trainer), false);
  assert.equal(isBeforeStart(new Date('2026-10-30T00:00:00Z'), trainer), false);
});

test('planForTrainer — слоты Пн–Пт, начало 20.10.2026 → 9 занятий в октябре', () => {
  const slots = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, isActive: true }));
  const ctx = { closedSet: new Set(), monthDates: getMonthDateList(2026, 10), pausesByTrainer: new Map() };

  assert.equal(planForTrainer({ id: 1, slots, startDate: null }, ctx), 22);
  assert.equal(planForTrainer({ id: 1, slots, startDate: new Date('2026-10-20T00:00:00Z') }, ctx), 9);
});
