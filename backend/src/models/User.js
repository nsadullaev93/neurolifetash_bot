const prisma = require('../database/connection');

async function findByTelegramId(telegramId) {
  return prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
}

async function upsertFromTelegram(from) {
  const telegramId = BigInt(from.id);
  const existing = await prisma.user.findUnique({ where: { telegramId } });

  if (existing) {
    return prisma.user.update({
      where: { telegramId },
      data: {
        firstName: from.first_name || existing.firstName,
        lastName: from.last_name || existing.lastName,
        username: from.username || existing.username,
      },
    });
  }

  const usersCount = await prisma.user.count();

  return prisma.user.create({
    data: {
      telegramId,
      firstName: from.first_name || 'Родитель',
      lastName: from.last_name || null,
      username: from.username || null,
      isAdmin: usersCount === 0,
    },
  });
}

async function listAll() {
  return prisma.user.findMany({ orderBy: { id: 'asc' } });
}

async function updateReminderSettings(telegramId, { remindersOn, reminderTime }) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: {
      ...(remindersOn !== undefined ? { remindersOn } : {}),
      ...(reminderTime !== undefined ? { reminderTime } : {}),
    },
  });
}

// status: 'PENDING' | 'APPROVED' | 'REJECTED'. Clears accessRequestNotifiedAt
// so that if this user is ever moved back to PENDING later (manually, or by
// a future "request access again" flow), a fresh notification goes out
// instead of silently staying quiet because a row already existed.
async function setAccessStatus(telegramId, status) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { accessStatus: status, accessRequestNotifiedAt: null },
  });
}

async function markAccessRequestNotified(telegramId) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { accessRequestNotifiedAt: new Date() },
  });
}

module.exports = {
  findByTelegramId,
  upsertFromTelegram,
  listAll,
  updateReminderSettings,
  setAccessStatus,
  markAccessRequestNotified,
};
