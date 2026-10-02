const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computePaymentStatus } = require('../src/utils/paymentStatus');

test('amount <= 0 (например, специалист на паузе весь месяц) — всегда PAID, долг не возникает', () => {
  assert.equal(computePaymentStatus(0, 0), 'PAID');
  assert.equal(computePaymentStatus(-100000, 0), 'PAID');
});

test('ничего не оплачено при положительной сумме к оплате — UNPAID', () => {
  assert.equal(computePaymentStatus(500000, 0), 'UNPAID');
});

test('оплачено частично — PARTIAL', () => {
  assert.equal(computePaymentStatus(500000, 200000), 'PARTIAL');
});

test('оплачено полностью или с переплатой — PAID', () => {
  assert.equal(computePaymentStatus(500000, 500000), 'PAID');
  assert.equal(computePaymentStatus(500000, 600000), 'PAID');
});
