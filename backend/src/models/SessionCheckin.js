const prisma = require('../database/connection');

async function listForSession(sessionId) {
  return prisma.sessionCheckin.findMany({ where: { sessionId: Number(sessionId) } });
}

async function existsForSession(sessionId) {
  const found = await prisma.sessionCheckin.findFirst({ where: { sessionId: Number(sessionId) } });
  return !!found;
}

async function create(sessionId, userId, chatId, messageId) {
  return prisma.sessionCheckin.create({
    data: { sessionId: Number(sessionId), userId, chatId: BigInt(chatId), messageId },
  });
}

// Был ли уже отправлен хоть один чекин СЕГОДНЯ (для кнопки «Сегодня не
// идём» — она добавляется только к первому сообщению дня, ТЗ v2, §7.1).
async function existsForDate(dateOnlyValue) {
  const found = await prisma.sessionCheckin.findFirst({
    where: { session: { date: dateOnlyValue } },
  });
  return !!found;
}

module.exports = { listForSession, existsForSession, create, existsForDate };
