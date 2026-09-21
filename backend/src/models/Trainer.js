const prisma = require('../database/connection');
const { getFamilyId } = require('../utils/scope');

async function listAll({ onlyActive = false } = {}) {
  const familyId = await getFamilyId();
  return prisma.trainer.findMany({
    where: onlyActive ? { familyId, isActive: true } : { familyId },
    include: { level: true, slots: true },
    orderBy: { id: 'asc' },
  });
}

async function findById(id) {
  return prisma.trainer.findUnique({
    where: { id: Number(id) },
    include: { level: true, slots: true },
  });
}

async function create(data) {
  const familyId = await getFamilyId();
  return prisma.trainer.create({ data: { ...data, familyId } });
}

async function update(id, data) {
  return prisma.trainer.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.trainer.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, findById, create, update, remove };
