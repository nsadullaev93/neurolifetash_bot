const prisma = require('../database/connection');

async function listAll() {
  return prisma.level.findMany({ orderBy: { rate: 'asc' } });
}

async function findById(id) {
  return prisma.level.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  return prisma.level.create({ data });
}

async function update(id, data) {
  return prisma.level.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.level.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, findById, create, update, remove };
