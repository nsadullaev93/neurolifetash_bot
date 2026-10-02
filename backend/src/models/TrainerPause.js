const prisma = require('../database/connection');

// Все паузы (прошлые, текущие, будущие) — для списка в Admin Panel.
async function listAll() {
  return prisma.trainerPause.findMany({
    include: { trainer: true },
    orderBy: { fromDate: 'desc' },
  });
}

// Паузы, пересекающиеся с месяцем (нужны для расчёта плана — forecast.service.js).
async function listOverlappingMonth(year, month) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  return prisma.trainerPause.findMany({
    where: {
      fromDate: { lte: monthEnd },
      OR: [{ toDate: null }, { toDate: { gte: monthStart } }],
    },
  });
}

async function findById(id) {
  return prisma.trainerPause.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  return prisma.trainerPause.create({ data, include: { trainer: true } });
}

async function remove(id) {
  return prisma.trainerPause.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, listOverlappingMonth, findById, create, remove };
