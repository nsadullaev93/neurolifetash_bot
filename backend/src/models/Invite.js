const crypto = require('crypto');
const prisma = require('../database/connection');
const { getFamilyId } = require('../utils/scope');

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа, ТЗ v2 §2.14

async function create(createdById) {
  const familyId = await getFamilyId();
  const code = crypto.randomBytes(9).toString('base64url');
  return prisma.invite.create({
    data: { familyId, code, expiresAt: new Date(Date.now() + INVITE_TTL_MS), createdById },
  });
}

// Атомарно "занимает" приглашение одним UPDATE с условием в WHERE —
// вместо раздельных findValidByCode + markUsed (аудит надёжности, фаза 1).
// Раздельные вызовы оставляли окно гонки: между чтением и пометкой
// "использовано" код успевала обработать другая async-работа (создание
// пользователя/участника), и два человека, открывшие одну ссылку почти
// одновременно, оба проходили проверку валидности и оба присоединялись к
// семье по одному приглашению. Один SQL UPDATE с usedAt/expiresAt в WHERE
// атомарен на уровне строки в Postgres — вторая попытка гарантированно
// увидит usedAt уже выставленным и обновит 0 строк.
async function claim(code) {
  const now = new Date();
  const result = await prisma.invite.updateMany({
    where: { code, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (result.count === 0) return null;
  return prisma.invite.findUnique({ where: { code } });
}

module.exports = { create, claim };
