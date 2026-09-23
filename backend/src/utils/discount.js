'use strict';

const config = require('../config/default');

// Скидка 10% при оплате от config.discountThresholdSessions занятий в
// месяц (включительно) — доступна по достижению порога, но применяется по
// усмотрению администрации центра (не авто-правило): при одинаковом
// количестве занятий в разные месяцы может быть применена или нет.
function canApplyDiscount(paidSessions) {
  return paidSessions >= config.discountThresholdSessions;
}

function rateWithDiscount(baseRate, discountApplied) {
  return discountApplied ? Math.round(baseRate * (1 - config.discountRate)) : baseRate;
}

module.exports = { canApplyDiscount, rateWithDiscount };
