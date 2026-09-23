const { test } = require('node:test');
const assert = require('node:assert/strict');
const { canApplyDiscount, rateWithDiscount } = require('../src/utils/discount');

test('скидка доступна только строго больше 20 оплаченных занятий в месяц', () => {
  assert.equal(canApplyDiscount(0), false);
  assert.equal(canApplyDiscount(20), false);
  assert.equal(canApplyDiscount(21), true);
});

test('rateWithDiscount снижает ставку на 10% и округляет до целого', () => {
  assert.equal(rateWithDiscount(230000, true), 207000);
  assert.equal(rateWithDiscount(277000, true), 249300);
  assert.equal(rateWithDiscount(230000, false), 230000);
});
