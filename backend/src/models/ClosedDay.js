const prisma = require('../database/connection');
const { getMonthDateList } = require('../utils/date');
const { getFamilyId } = require('../utils/scope');

async function listAll() {
  return prisma.closedDay.findMany({ orderBy: { date: 'asc' } });
}

async function listForMonth(year, month) {
  const list = getMonthDateList(year, month);
  return prisma.closedDay.findMany({
    where: { date: { gte: list[0], lte: list[list.length - 1] } },
    orderBy: { date: 'asc' },
  });
}

// dateOnlyValue must be a UTC-midnight Date, see utils/date.js
async function isClosed(dateOnlyValue) {
  const familyId = await getFamilyId();
  const found = await prisma.closedDay.findUnique({
    where: { familyId_date: { familyId, date: dateOnlyValue } },
  });
  return !!found;
}

async function create(data) {
  const familyId = await getFamilyId();
  return prisma.closedDay.create({ data: { ...data, familyId } });
}

async function remove(id) {
  return prisma.closedDay.delete({ where: { id: Number(id) } });
}

// Создаёт ClosedDay и переводит ещё не отмеченные занятия этого дня в
// CLOSED_DAY — общая логика для Admin Panel, праздничного диалога бота
// (§2.13) и будущей кнопки «Сегодня не идём» → «Центр закрыт» (§2.13, §7.1).
async function createAndCancelSessions(dateOnlyValue, title) {
  const closedDay = await create({ date: dateOnlyValue, title });
  await prisma.session.updateMany({
    where: { date: dateOnlyValue, status: 'PLANNED' },
    data: { status: 'CLOSED_DAY' },
  });
  return closedDay;
}

module.exports = { listAll, listForMonth, isClosed, create, remove, createAndCancelSessions };
