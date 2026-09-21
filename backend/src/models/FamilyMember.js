const prisma = require('../database/connection');
const config = require('../config/default');
const { getFamilyId } = require('../utils/scope');

function isOwnerTelegramId(telegramId) {
  return !!config.ownerTelegramId && String(telegramId) === String(config.ownerTelegramId);
}

async function findByUserId(userId) {
  const familyId = await getFamilyId();
  return prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: Number(userId) } },
  });
}

async function listAll() {
  const familyId = await getFamilyId();
  return prisma.familyMember.findMany({ where: { familyId }, include: { user: true }, orderBy: { joinedAt: 'asc' } });
}

// Гарантирует, что у одобренного пользователя есть запись FamilyMember —
// вызывается из resolveAccess при каждом переходе в статус 'approved'
// (ТЗ v2, §2.14). Идемпотентно: уже существующую запись не трогает.
// Владелец (OWNER_TELEGRAM_ID) получает роль OWNER и видимость денег сразу;
// остальные — MEMBER без доступа к деньгам по умолчанию.
async function ensureForUser(user) {
  const existing = await findByUserId(user.id);
  if (existing) return existing;

  const familyId = await getFamilyId();
  const owner = isOwnerTelegramId(user.telegramId);
  return prisma.familyMember.create({
    data: {
      familyId,
      userId: user.id,
      role: owner ? 'OWNER' : 'MEMBER',
      displayName: user.firstName || 'Участник',
      canSeeMoney: owner,
    },
  });
}

// Для вступления по пригласительной ссылке (§2.14) — роль берётся из Invite.
async function createFromInvite(user, invite) {
  const familyId = await getFamilyId();
  return prisma.familyMember.create({
    data: {
      familyId,
      userId: user.id,
      role: invite.role,
      displayName: user.firstName || 'Участник',
      canSeeMoney: invite.role === 'OWNER',
    },
  });
}

async function setCanSeeMoney(id, canSeeMoney) {
  return prisma.familyMember.update({ where: { id: Number(id) }, data: { canSeeMoney } });
}

async function remove(id) {
  return prisma.familyMember.delete({ where: { id: Number(id) } });
}

module.exports = { findByUserId, listAll, ensureForUser, createFromInvite, setCanSeeMoney, remove };
