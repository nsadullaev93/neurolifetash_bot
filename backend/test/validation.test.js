// Чистая логика, без БД — можно гонять где угодно, в т.ч. в CI без
// доступа к продакшен-Neon.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateBackupShape, parseStrictDateOnly } = require('../src/utils/validation');

const validBackup = {
  version: 1,
  family: {},
  children: [], users: [], familyMembers: [], levels: [], trainers: [],
  scheduleSlots: [], sessions: [], holidays: [], closedDays: [],
  monthlyPayments: [], settlements: [], sessionNotes: [],
};

test('validateBackupShape принимает корректный бэкап', () => {
  assert.equal(validateBackupShape(validBackup), null);
});

test('validateBackupShape отклоняет не-объект', () => {
  assert.notEqual(validateBackupShape(null), null);
  assert.notEqual(validateBackupShape('oops'), null);
});

test('validateBackupShape отклоняет неверную версию', () => {
  assert.notEqual(validateBackupShape({ ...validBackup, version: 2 }), null);
});

test('validateBackupShape отклоняет отсутствующий/не-массив список', () => {
  assert.notEqual(validateBackupShape({ ...validBackup, sessions: 'oops' }), null);
  const { sessions, ...withoutSessions } = validBackup;
  assert.notEqual(validateBackupShape(withoutSessions), null);
});

test('parseStrictDateOnly принимает корректную дату', () => {
  const d = parseStrictDateOnly('2026-09-22');
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString().slice(0, 10), '2026-09-22');
});

test('parseStrictDateOnly отклоняет перекатывающиеся месяц/день', () => {
  assert.equal(parseStrictDateOnly('2026-13-40'), null);
  assert.equal(parseStrictDateOnly('2026-02-30'), null);
});

test('parseStrictDateOnly отклоняет мусор и не-строки', () => {
  assert.equal(parseStrictDateOnly('not-a-date'), null);
  assert.equal(parseStrictDateOnly(null), null);
  assert.equal(parseStrictDateOnly(undefined), null);
});
