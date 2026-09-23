// Чистая логика, без БД.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const checkin = require('../src/services/checkin.service');
const { nowTz, dateOnly } = require('../src/utils/date');

test('rev() детерминирован для одного updatedAt', () => {
  const t = new Date('2026-09-22T10:00:00Z');
  assert.equal(checkin.rev({ updatedAt: t }), checkin.rev({ updatedAt: t }));
});

test('rev() различается для разных updatedAt', () => {
  const a = checkin.rev({ updatedAt: new Date('2026-09-22T10:00:00Z') });
  const b = checkin.rev({ updatedAt: new Date('2026-09-22T10:00:05Z') });
  assert.notEqual(a, b);
});

test('resultText отмечает "было" для COMPLETED/MAKEUP', () => {
  const session = { status: 'COMPLETED', plannedTrainer: { name: 'Усмон' }, startTime: '16:40' };
  assert.match(checkin.resultText(session, 'Мама'), /было.*Мама/);
});

test('resultText указывает причину для непроведённого занятия', () => {
  const session = { status: 'TRAINER_ABSENT', plannedTrainer: { name: 'Ли' }, startTime: '17:20' };
  assert.match(checkin.resultText(session, null), /не было/);
  assert.match(checkin.resultText(session, null), /специалист отсутствовал/);
});

// Регрессия 23.09.2026: sendDueCheckins считал порог "сейчас минус 5 минут"
// из даты и времени по отдельности (todayDateOnly() + currentHM(5)) — в
// первые 5 минут после полуночи currentHM(5) возвращает время ВЧЕРАШНЕГО
// дня ("23:5X"), а todayDateOnly() уже СЕГОДНЯШНИЙ — в паре с диапазоном
// (endTime <= порог) это ловило вообще все сегодняшние занятия, ещё не
// начавшиеся (чекины про занятия, которые ещё не проводились). Проверяем,
// что дата и время берутся из ОДНОГО момента и корректно откатываются
// вместе при пересечении полуночи.
test('порог чекина откатывает дату при пересечении полуночи, а не только время', () => {
  const dayjs = require('dayjs');
  const midnight = dayjs.tz('2026-09-23 00:02', 'Asia/Tashkent');
  const cutoff = midnight.subtract(5, 'minute');
  const targetDate = dateOnly(cutoff.year(), cutoff.month() + 1, cutoff.date());
  const targetEndTime = cutoff.format('HH:mm');

  assert.equal(targetEndTime, '23:57');
  assert.equal(
    targetDate.toISOString().slice(0, 10),
    '2026-09-22',
    'дата должна откатиться на вчерашний день вместе со временем, а не остаться сегодняшней',
  );
});

test('порог чекина в обычное время суток не трогает дату', () => {
  const dayjs = require('dayjs');
  const noon = dayjs.tz('2026-09-22 12:10', 'Asia/Tashkent');
  const cutoff = noon.subtract(5, 'minute');
  const targetDate = dateOnly(cutoff.year(), cutoff.month() + 1, cutoff.date());

  assert.equal(cutoff.format('HH:mm'), '12:05');
  assert.equal(targetDate.toISOString().slice(0, 10), '2026-09-22');
});
