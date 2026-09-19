function formatMoney(amount) {
  const n = Math.round(amount || 0);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('ru-RU').replace(/ /g, ' ');
  return `${n < 0 ? '-' : ''}${formatted} сум`;
}

function formatMoneySigned(amount) {
  const n = Math.round(amount || 0);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('ru-RU').replace(/ /g, ' ');
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${formatted} сум`;
}

module.exports = { formatMoney, formatMoneySigned };
