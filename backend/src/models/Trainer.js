const prisma = require('../database/connection');

async function listAll({ onlyActive = false } = {}) {
  return prisma.trainer.findMany({
    where: onlyActive ? { isActive: true } : {},
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
  return prisma.trainer.create({ data });
}

async function update(id, data) {
  return prisma.trainer.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.trainer.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, findById, create, update, remove };
