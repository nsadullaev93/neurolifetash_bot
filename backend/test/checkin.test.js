// Чистая логика, без БД.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dayjs = require('dayjs');
const checkin = require('../src/services/checkin.service');
const { nowTz, dateOnly, combineDateAndTime } = require('../src/utils/date');

// Тот же предикат "занятие уже наступило 5+ минут назад", что и в
// sendDueCheckins (checkin.service.js) — воспроизводит его напрямую на
// синтетических данных, без БД/бота.
function isDue(session, cutoff) {
  return !combineDateAndTime(session.date, session.endTime).isAfter(cutoff);
}

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

// Регрессия 23.09.2026 (первая попытка фикса): sendDueCheckins считал порог
// "сейчас минус 5 минут" из даты и времени по отдельности (todayDateOnly() +
// currentHM(5)) — в первые минуты после полуночи это расходилось, отправляя
// чекины про сегодняшние занятия, которые ещё не начались. Первый фикс
// объединил источник в один cutoff, но всё равно сравнивал "дата" и "время"
// ПО ОТДЕЛЬНОСТИ (date равенство + endTime диапазон) — в проде на
// следующую же полночь баг повторился (см. историю в checkin.service.js).
// Второй фикс убирает саму возможность разъехаться: сравнивается ОДИН
// комбинированный момент (combineDateAndTime) с ОДНИМ cutoff.
test('регрессия: вечернее занятие СЕГОДНЯШНЕГО дня не считается due сразу после полуночи', () => {
  const cutoff = dayjs.tz('2026-09-23 00:02', 'Asia/Tashkent').subtract(5, 'minute'); // 2026-09-22 23:57
  const eveningSessionToday = { date: dateOnly(2026, 9, 23), endTime: '16:40' };
  assert.equal(
    isDue(eveningSessionToday, cutoff),
    false,
    'занятие в 16:40 сегодняшнего дня не должно быть due в 00:02 (та самая полночная ошибка)',
  );
});

test('вчерашнее занятие, закончившееся перед самой полуночью, остаётся due (переживает пропущенный тик)', () => {
  const cutoff = dayjs.tz('2026-09-23 00:02', 'Asia/Tashkent').subtract(5, 'minute'); // 2026-09-22 23:57
  const lateSessionYesterday = { date: dateOnly(2026, 9, 22), endTime: '23:50' };
  assert.equal(isDue(lateSessionYesterday, cutoff), true);
});

test('порог чекина в обычное время суток корректно отсекает будущие занятия того же дня', () => {
  const cutoff = dayjs.tz('2026-09-22 12:10', 'Asia/Tashkent').subtract(5, 'minute'); // 12:05
  const justEnded = { date: dateOnly(2026, 9, 22), endTime: '12:00' };
  const notYet = { date: dateOnly(2026, 9, 22), endTime: '12:10' };
  assert.equal(isDue(justEnded, cutoff), true);
  assert.equal(isDue(notYet, cutoff), false);
});
