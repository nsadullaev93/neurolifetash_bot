const prisma = require('../database/connection');

async function listForSession(sessionId) {
  return prisma.sessionNote.findMany({
    where: { sessionId: Number(sessionId) },
    orderBy: { createdAt: 'asc' },
  });
}

// Дневник за период (ТЗ v2, §2.15) — заметки по датам занятий, с фильтром
// по специалисту опционально применяется на уровне вызывающего кода
// (нужен join с Session, которого тут для простоты нет — см. listForPeriod).
async function listForPeriod(fromDateOnly, toDateOnly) {
  return prisma.sessionNote.findMany({
    where: { session: { date: { gte: fromDateOnly, lte: toDateOnly } } },
    include: { session: { include: { plannedTrainer: true, actualTrainer: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function create(sessionId, authorUserId, text) {
  return prisma.sessionNote.create({
    data: { sessionId: Number(sessionId), authorUserId, text },
  });
}

async function findById(id) {
  return prisma.sessionNote.findUnique({ where: { id: Number(id) } });
}

async function update(id, text) {
  return prisma.sessionNote.update({ where: { id: Number(id) }, data: { text } });
}

async function remove(id) {
  return prisma.sessionNote.delete({ where: { id: Number(id) } });
}

module.exports = { listForSession, listForPeriod, create, findById, update, remove };
