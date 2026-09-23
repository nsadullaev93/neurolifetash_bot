const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const isoWeek = require('dayjs/plugin/isoWeek');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const TZ = 'Asia/Tashkent';

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const RU_MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const RU_WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function nowTz() {
  return dayjs().tz(TZ);
}

function nowYearMonth() {
  const n = nowTz();
  return { year: n.year(), month: n.month() + 1 };
}

function currentHM(minusMinutes = 0) {
  return nowTz().subtract(minusMinutes, 'minute').format('HH:mm');
}

// Date-only value stored/compared as a UTC-midnight JS Date representing a
// Tashkent calendar day (avoids timezone drift on the Postgres DATE column).
function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function todayDateOnly() {
  const n = nowTz();
  return dateOnly(n.year(), n.month() + 1, n.date());
}

// Собирает Date-only значение (UTC-полночь, представляющий календарный день
// в Ташкенте) и "HH:mm" в единый dayjs-момент в таймзоне Ташкента. Нужно
// везде, где раньше "дата" и "время" сравнивались с cutoff по отдельности —
// именно из-за такого раздельного сравнения был баг чат-чекинов 23.09.2026
// (checkin.service.js): на границе полуночи "дата" и "время" считались из
// одного и того же cutoff, но всё равно ушли в разные дни в проде, отчего
// чекины на ещё не начавшиеся вечерние занятия ушли в 00:00. Сравнение
// ЕДИНОГО момента с другим единым моментом такого расхождения структурно не
// допускает.
function combineDateAndTime(dateOnlyValue, hm) {
  const d = new Date(dateOnlyValue);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return dayjs.tz(`${y}-${mo}-${day} ${hm}`, TZ);
}

function toDateOnly(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function ymd(d) {
  const x = new Date(d);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
}

// ISO weekday: Monday = 1 ... Sunday = 7
function isoWeekday(d) {
  const x = new Date(d);
  const day = x.getUTCDay(); // Sunday = 0 ... Saturday = 6
  return day === 0 ? 7 : day;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextMonthOf(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function prevMonthOf(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function getMonthDateList(year, month) {
  const total = daysInMonth(year, month);
  const list = [];
  for (let day = 1; day <= total; day++) {
    list.push(dateOnly(year, month, day));
  }
  return list;
}

function isSameDate(a, b) {
  const da = toDateOnly(a);
  const db = toDateOnly(b);
  return da.getTime() === db.getTime();
}

function isLastDayOfMonth(year, month, day) {
  return day === daysInMonth(year, month);
}

function formatDateRu(d) {
  const x = new Date(d);
  const day = x.getUTCDate();
  const month = RU_MONTHS[x.getUTCMonth()];
  const year = x.getUTCFullYear();
  const weekday = RU_WEEKDAYS_SHORT[isoWeekday(x) - 1];
  return `${day} ${month} ${year}, ${weekday}`;
}

function formatDateLong(d) {
  const x = new Date(d);
  const day = x.getUTCDate();
  const month = RU_MONTHS[x.getUTCMonth()];
  const year = x.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function formatDateShort(d) {
  const x = new Date(d);
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = x.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function monthName(month) {
  return RU_MONTHS_NOM[month - 1];
}

module.exports = {
  TZ,
  nowTz,
  nowYearMonth,
  currentHM,
  dateOnly,
  todayDateOnly,
  combineDateAndTime,
  toDateOnly,
  ymd,
  isoWeekday,
  daysInMonth,
  getMonthDateList,
  nextMonthOf,
  prevMonthOf,
  isSameDate,
  isLastDayOfMonth,
  formatDateRu,
  formatDateLong,
  formatDateShort,
  monthName,
  RU_WEEKDAYS_SHORT,
  RU_MONTHS_NOM,
};
