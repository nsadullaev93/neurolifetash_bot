const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPausedOn } = require('../src/utils/trainerPause');

test('isPausedOn — дата внутри диапазона с датой окончания', () => {
  const pauses = [{ fromDate: '2026-10-01', toDate: '2026-10-15' }];
  assert.equal(isPausedOn(new Date('2026-10-01T00:00:00Z'), pauses), true);
  assert.equal(isPausedOn(new Date('2026-10-15T00:00:00Z'), pauses), true);
  assert.equal(isPausedOn(new Date('2026-10-08T00:00:00Z'), pauses), true);
  assert.equal(isPausedOn(new Date('2026-09-30T00:00:00Z'), pauses), false);
  assert.equal(isPausedOn(new Date('2026-10-16T00:00:00Z'), pauses), false);
});

test('isPausedOn — toDate=null означает бессрочно (до ручного завершения)', () => {
  const pauses = [{ fromDate: '2026-10-01', toDate: null }];
  assert.equal(isPausedOn(new Date('2026-12-31T00:00:00Z'), pauses), true);
  assert.equal(isPausedOn(new Date('2026-09-30T00:00:00Z'), pauses), false);
});

test('isPausedOn — несколько пауз, достаточно попасть в одну из них', () => {
  const pauses = [
    { fromDate: '2026-10-01', toDate: '2026-10-05' },
    { fromDate: '2026-10-20', toDate: '2026-10-25' },
  ];
  assert.equal(isPausedOn(new Date('2026-10-22T00:00:00Z'), pauses), true);
  assert.equal(isPausedOn(new Date('2026-10-10T00:00:00Z'), pauses), false);
});

test('isPausedOn — пустой список пауз', () => {
  assert.equal(isPausedOn(new Date('2026-10-01T00:00:00Z'), []), false);
});
