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

// Только для сообщения пользователю после неудачного claim() — читает код
// ещё раз, отдельно от атомарной попытки выше, просто чтобы сказать
// точнее, что пошло не так (аудит надёжности, фаза 6: раньше все три
// причины — код не существует, уже использован, истёк — превращались в
// одно и то же обтекаемое сообщение).
async function diagnoseFailure(code) {
  const invite = await prisma.invite.findUnique({ where: { code } });
  if (!invite) return 'Пригласительная ссылка не найдена — проверьте, что скопировали её полностью.';
  if (invite.usedAt) return 'Эта пригласительная ссылка уже использована — она одноразовая.';
  if (invite.expiresAt < new Date()) return 'Срок действия пригласительной ссылки истёк (действует 24 часа). Попросите новую.';
  return 'Пригласительная ссылка недействительна.';
}

module.exports = { create, claim, diagnoseFailure };
