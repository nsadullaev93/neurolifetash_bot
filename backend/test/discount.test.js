const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canApplyDiscount, rateWithDiscount } = require('../src/utils/discount');

test('скидка доступна от 20 оплаченных занятий в месяц включительно', () => {
  assert.equal(canApplyDiscount(0), false);
  assert.equal(canApplyDiscount(19), false);
  assert.equal(canApplyDiscount(20), true);
  assert.equal(canApplyDiscount(21), true);
});

test('rateWithDiscount снижает ставку на 10% и округляет до целого', () => {
  assert.equal(rateWithDiscount(230000, true), 207000);
  assert.equal(rateWithDiscount(277000, true), 249300);
  assert.equal(rateWithDiscount(230000, false), 230000);
});
