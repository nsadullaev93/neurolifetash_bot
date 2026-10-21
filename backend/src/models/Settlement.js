const prisma = require('../database/connection');

async function listForMonth(year, month) {
  return prisma.settlement.findMany({
    where: { year, month },
    include: { trainer: { include: { level: true } } },
    orderBy: { trainerId: 'asc' },
  });
}

// Возвращает все расчёты — фильтрация по периоду делается в JS (объём
// данных небольшой: одна семья, несколько специалистов). Используется
// stats.service.js для сумм "оплачено отдельно" за произвольный период.
async function listAll() {
  return prisma.settlement.findMany({
    include: { trainer: { include: { level: true } } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { trainerId: 'asc' }],
  });
}

async function findByYearMonthTrainer(year, month, trainerId) {
  return prisma.settlement.findUnique({
    where: { year_month_trainerId: { year, month, trainerId: Number(trainerId) } },
  });
}

async function upsert(year, month, trainerId, data) {
  return prisma.settlement.upsert({
    where: { year_month_trainerId: { year, month, trainerId: Number(trainerId) } },
    update: data,
    create: { year, month, trainerId: Number(trainerId), ...data },
  });
}

// Для случаев, когда запись заведомо уже существует (balance посчитан
// раньше, при закрытии месяца) — не требует полного набора полей create.
async function update(year, month, trainerId, data) {
  return prisma.settlement.update({
    where: { year_month_trainerId: { year, month, trainerId: Number(trainerId) } },
    data,
    include: { trainer: true },
  });
}

// Перенесённые остатки, которые зачитываются в указанный месяц.
async function listCarriedInto(year, month) {
  return prisma.settlement.findMany({
    where: { status: 'CARRIED_OVER', carriedToYear: year, carriedToMonth: month },
    include: { trainer: true, carriedToTrainer: true },
    orderBy: { trainerId: 'asc' },
  });
}

// Все перенесённые остатки — для строк «зачтено из остатка» в истории оплат.
async function listCarriedOver() {
  return prisma.settlement.findMany({
    where: { status: 'CARRIED_OVER' },
    include: { trainer: true, carriedToTrainer: true },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { trainerId: 'asc' }],
  });
}

async function findById(id) {
  return prisma.settlement.findUnique({ where: { id: Number(id) } });
}

async function setCarryTarget(id, carriedToTrainerId) {
  return prisma.settlement.update({
    where: { id: Number(id) },
    data: { carriedToTrainerId },
    include: { trainer: true, carriedToTrainer: true },
  });
}

module.exports = {
  listForMonth,
  listAll,
  findByYearMonthTrainer,
  upsert,
  update,
  listCarriedInto,
  listCarriedOver,
  findById,
  setCarryTarget,
};
