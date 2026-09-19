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

export const RU_MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const WEEKDAY_NAMES = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница', 6: 'Суббота', 7: 'Воскресенье' };

export const STATUS_LABELS = {
  PLANNED: 'Запланировано',
  COMPLETED: 'Проведено',
  MAKEUP: 'Отработка',
  TRAINER_ABSENT: 'Специалист отсутствовал',
  CHILD_SICK_CERT: 'Ребёнок болел (справка есть)',
  CHILD_SICK_NO_CERT: 'Ребёнок болел (справки нет)',
  CHILD_ABSENT: 'Ребёнок отсутствовал',
  CLOSED_DAY: 'Праздник / центр закрыт',
  RESCHEDULED: 'Перенесено, ждёт отработки',
};

export function balanceColor(balance) {
  if (balance > 0) return 'green';
  if (balance < 0) return 'red';
  return 'gray';
}
