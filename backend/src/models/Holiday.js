const prisma = require('../database/connection');
const { getFamilyId } = require('../utils/scope');

async function listAll() {
  const familyId = await getFamilyId();
  return prisma.holiday.findMany({ where: { familyId }, orderBy: { date: 'asc' } });
}

async function listForMonth(year, month) {
  const familyId = await getFamilyId();
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return prisma.holiday.findMany({
    where: { familyId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  });
}

// Праздники в указанном диапазоне дат (включительно), ещё не подтверждённые
// (UNKNOWN) — для вопроса бота «Центр работает?» (ТЗ v2, §2.13).
async function listUnknownBetween(fromDate, toDate) {
  const familyId = await getFamilyId();
  return prisma.holiday.findMany({
    where: { familyId, date: { gte: fromDate, lte: toDate }, status: 'UNKNOWN' },
    orderBy: { date: 'asc' },
  });
}

async function findById(id) {
  return prisma.holiday.findUnique({ where: { id: Number(id) } });
}

async function setStatus(id, status) {
  return prisma.holiday.update({ where: { id: Number(id) }, data: { status } });
}

async function upsertByDate(date, title) {
  const familyId = await getFamilyId();
  return prisma.holiday.upsert({
    where: { familyId_date: { familyId, date } },
    update: { title },
    create: { familyId, date, title },
  });
}

module.exports = { listAll, listForMonth, listUnknownBetween, findById, setStatus, upsertByDate };
