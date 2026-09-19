export function formatMoney(amount) {
  const n = Math.round(amount || 0);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('ru-RU').replace(/ /g, ' ');
  return `${n < 0 ? '-' : ''}${formatted} сум`;
}

export function formatMoneySigned(amount) {
  const n = Math.round(amount || 0);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('ru-RU').replace(/ /g, ' ');
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${formatted} сум`;
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const RU_MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const RU_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function formatDateRu(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDate();
  const month = RU_MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function isoWeekday(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

export function dayNumber(dateStr) {
  return new Date(dateStr).getUTCDate();
}

export function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function balanceColor(balance) {
  if (balance > 0) return 'green';
  if (balance < 0) return 'red';
  return 'gray';
}
