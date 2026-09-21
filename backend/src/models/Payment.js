const prisma = require('../database/connection');

async function listForMonth(year, month) {
  return prisma.monthlyPayment.findMany({
    where: { year, month },
    include: { trainer: { include: { level: true } } },
    orderBy: { trainerId: 'asc' },
  });
}

async function listForTrainer(trainerId) {
  return prisma.monthlyPayment.findMany({
    where: { trainerId: Number(trainerId) },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

async function listAll() {
  return prisma.monthlyPayment.findMany({
    include: { trainer: { include: { level: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { trainerId: 'asc' }],
  });
}

// Несколько оплат одному специалисту за месяц теперь допустимы (ТЗ v2, §2.10),
// поэтому уникального ключа больше нет — возвращает список, не одну запись.
async function listForYearMonthTrainer(year, month, trainerId) {
  return prisma.monthlyPayment.findMany({
    where: { year, month, trainerId: Number(trainerId) },
  });
}

async function findById(id) {
  return prisma.monthlyPayment.findUnique({ where: { id: Number(id) } });
}

async function create(data) {
  return prisma.monthlyPayment.create({ data, include: { trainer: { include: { level: true } } } });
}

async function update(id, data) {
  return prisma.monthlyPayment.update({
    where: { id: Number(id) },
    data,
    include: { trainer: { include: { level: true } } },
  });
}

async function remove(id) {
  return prisma.monthlyPayment.delete({ where: { id: Number(id) } });
}

module.exports = {
  listForMonth,
  listForTrainer,
  listAll,
  listForYearMonthTrainer,
  findById,
  create,
  update,
  remove,
};
