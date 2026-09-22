// Чистая логика, без БД.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const checkin = require('../src/services/checkin.service');

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
