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

// Неотмеченные занятия в диапазоне дат — кандидаты на чат-чекин через 5
// минут после конца (ТЗ v2, §7.1). checkin.service.sendDueCheckins сам
// решает, у кого из них конец уже наступил (сравнивая единый момент
// дата+время с cutoff — см. combineDateAndTime в utils/date.js), поэтому
// здесь фильтр только по статусу и достаточно широкому диапазону дат:
// раньше кандидаты выбирались прямо в БД по endTime <= "HH:MM" ПРИ
// точном совпадении date — из-за раздельного сравнения даты и времени на
// границе полуночи 23.09.2026 чекины ушли на ещё не начавшиеся вечерние
// занятия (см. коммит). Диапазон дат (а не отдельные дата+время в SQL) не
// допускает такого расхождения в принципе.
async function listPlannedInDateRange(fromDateOnly, toDateOnly) {
  return prisma.session.findMany({
    where: { date: { gte: fromDateOnly, lte: toDateOnly }, status: 'PLANNED' },
    include: includeTrainers,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
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
  listPlannedInDateRange,
  update,
  create,
  remove,
  effectiveTrainerId,
  countCompletedForTrainerMonth,
  getMonthDateList,
};
