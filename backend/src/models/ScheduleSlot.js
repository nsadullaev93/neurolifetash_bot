const prisma = require('../database/connection');
const { getChildId } = require('../utils/scope');

async function listAll() {
  return prisma.scheduleSlot.findMany({
    include: { trainer: { include: { level: true } } },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
  });
}

async function listActive() {
  return prisma.scheduleSlot.findMany({
    where: { isActive: true, trainer: { isActive: true } },
    include: { trainer: { include: { level: true } } },
  });
}

async function findById(id) {
  return prisma.scheduleSlot.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  const childId = await getChildId();
  return prisma.scheduleSlot.create({ data: { ...data, childId } });
}

async function update(id, data) {
  return prisma.scheduleSlot.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.scheduleSlot.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, listActive, findById, create, update, remove };
