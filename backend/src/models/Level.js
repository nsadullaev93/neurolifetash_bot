const prisma = require('../database/connection');
const { getFamilyId } = require('../utils/scope');

async function listAll() {
  const familyId = await getFamilyId();
  return prisma.level.findMany({ where: { familyId }, orderBy: { rate: 'asc' } });
}

async function findById(id) {
  return prisma.level.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  const familyId = await getFamilyId();
  return prisma.level.create({ data: { ...data, familyId } });
}

async function update(id, data) {
  return prisma.level.update({ where: { id: Number(id) }, data });
}

async function remove(id) {
  return prisma.level.delete({ where: { id: Number(id) } });
}

module.exports = { listAll, findById, create, update, remove };
