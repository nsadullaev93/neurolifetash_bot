'use strict';

/** 4830000 → "4 830 000 сум" */
function formatSum(amount) {
  const abs = Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '−' : ''}${abs} сум`;
}

/** Баланс со знаком: +2 660 000 сум / −460 000 сум / 0 сум */
function formatBalance(amount) {
  if (amount > 0) return `+${formatSum(amount)}`;
  return formatSum(amount);
}

module.exports = { formatSum, formatBalance };
