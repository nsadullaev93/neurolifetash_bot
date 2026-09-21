const prisma = require('../database/connection');
const { getMonthDateList } = require('../utils/date');
const { getChildId } = require('../utils/scope');

const includeTrainers = {
  plannedTrainer: { include: { level: true } },
  actualTrainer: { include: { level: true } },
};

async function findById(id) {
  return prisma.session.findUnique({ where: { id: Number(id) }, include: includeTrainers });
}

async function listForDate(dateOnlyValue) {
  return prisma.session.findMany({
    where: { date: dateOnlyValue },
    include: includeTrainers,
    orderBy: { startTime: 'asc' },
  });
}

async function listForMonth(year, month) {
  return prisma.session.findMany({
    where: { year, month },
    include: includeTrainers,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}

async function listBetween(fromDateOnly, toDateOnly) {
  return prisma.session.findMany({
    where: { date: { gte: fromDateOnly, lte: toDateOnly } },
    include: includeTrainers,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}

async function listUnmarkedBefore(dateOnlyValue) {
  return prisma.session.findMany({
    where: { date: { lt: dateOnlyValue }, status: 'PLANNED' },
    include: includeTrainers,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
}

async function countUnmarkedForDate(dateOnlyValue) {
  return prisma.session.count({ where: { date: dateOnlyValue, status: 'PLANNED' } });
}

async function update(id, data) {
  return prisma.session.update({ where: { id: Number(id) }, data, include: includeTrainers });
}

async function create(data) {
  const childId = await getChildId();
  return prisma.session.create({ data: { ...data, childId }, include: includeTrainers });
}

async function remove(id) {
  return prisma.session.delete({ where: { id: Number(id) } });
}

// Effective trainer id: actualTrainerId overrides plannedTrainerId when set.
function effectiveTrainerId(session) {
  return session.actualTrainerId || session.plannedTrainerId;
}

// Number of completed-or-makeup sessions for a trainer in a given month,
// counted by the EFFECTIVE trainer (actual overrides planned).
async function countCompletedForTrainerMonth(trainerId, year, month) {
  const [byActual, byPlannedNoActual] = await Promise.all([
    prisma.session.count({
      where: {
        year,
        month,
        actualTrainerId: trainerId,
        status: { in: ['COMPLETED', 'MAKEUP'] },
      },
    }),
    prisma.session.count({
      where: {
        year,
        month,
        plannedTrainerId: trainerId,
        actualTrainerId: null,
        status: { in: ['COMPLETED', 'MAKEUP'] },
      },
    }),
  ]);
  return byActual + byPlannedNoActual;
}

module.exports = {
  findById,
  listForDate,
  listForMonth,
  listBetween,
  listUnmarkedBefore,
  countUnmarkedForDate,
  update,
  create,
  remove,
  effectiveTrainerId,
  countCompletedForTrainerMonth,
  getMonthDateList,
};
