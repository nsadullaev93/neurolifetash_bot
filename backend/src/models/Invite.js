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

async function findValidByCode(code) {
  const invite = await prisma.invite.findUnique({ where: { code } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

async function markUsed(id) {
  return prisma.invite.update({ where: { id }, data: { usedAt: new Date() } });
}

module.exports = { create, findValidByCode, markUsed };
