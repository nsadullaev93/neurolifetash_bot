'use strict';

// Статус оплаты специалиста за месяц (ТЗ v2, §2.10). amount <= 0 означает,
// что за этот период ничего не причитается (например, специалист весь
// месяц на паузе/в отпуске — §2.6.1) — в этом случае "не оплачено" было бы
// ложным долгом, поэтому статус всегда PAID независимо от paidAmount.
function computePaymentStatus(amount, paidAmount) {
  if (amount <= 0) return 'PAID';
  if (paidAmount === 0) return 'UNPAID';
  if (paidAmount < amount) return 'PARTIAL';
  return 'PAID';
}

module.exports = { computePaymentStatus };
