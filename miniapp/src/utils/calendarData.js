import { api } from '../api/client';

// Данные календаря по месяцам — на время работы мини-аппа: уже открытый месяц
// показывается сразу, свежие данные подгружаются поверх. После входа текущий
// месяц (и код экрана календаря) подгружаются в фоне — пока смотрят «Сегодня»,
// поэтому «Календарь» открывается уже раскрашенным.
const cache = new Map();

const keyOf = (year, month) => `${year}-${month}`;

export function cachedMonth(year, month) {
  return cache.get(keyOf(year, month)) || null;
}

export async function loadMonth(year, month) {
  const [monthData, trainers, todayData, holidays] = await Promise.all([
    api.getMonthSessions(year, month),
    api.getTrainers(),
    api.getToday(),
    api.getHolidays(),
  ]);
  const data = {
    sessions: monthData.sessions,
    trainers,
    todayKey: todayData.date.slice(0, 10),
    // Праздник в календаре — только подтверждённый закрытым (§2.13): пока
    // статус ещё UNKNOWN/OPEN, день красится как обычный рабочий/будущий.
    closedHolidayKeys: new Set(holidays.filter((h) => h.status === 'CLOSED').map((h) => h.date.slice(0, 10))),
  };
  cache.set(keyOf(year, month), data);
  return data;
}

export function warmCalendar() {
  const now = new Date();
  import('../pages/Calendar').catch(() => {}); // код экрана — заранее
  loadMonth(now.getFullYear(), now.getMonth() + 1).catch(() => {}); // нет сети — экран загрузит сам
}
