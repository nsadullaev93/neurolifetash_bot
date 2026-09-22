// Интеграционный тест против реальной продакшен Neon-базы (см. invite.test.js
// для объяснения, почему нет отдельной тестовой БД). Использует заведомо
// фейковый Telegram ID, чтобы не трогать реальных участников семьи;
// восстанавливает исходный config.ownerTelegramId и удаляет за собой
// скретч-пользователя в finally.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/default'); // грузит backend/.env (DATABASE_URL и т.д.)

if (!process.env.DATABASE_URL) {
  test('FamilyMember.ensureForUser — пропущено (нет DATABASE_URL)', { skip: true }, () => {});
  return;
}

const prisma = require('../src/database/connection');
const config = require('../src/config/default');
const FamilyMemberModel = require('../src/models/FamilyMember');

after(() => prisma.$disconnect());

test('ensureForUser самоисцеляет роль при смене OWNER_TELEGRAM_ID', async () => {
  const familyId = (await prisma.family.findFirstOrThrow()).id;
  const scratchUser = await prisma.user.upsert({
    where: { telegramId: 999999999902n },
    create: { telegramId: 999999999902n, firstName: 'TestOwnerRoleSync', accessStatus: 'APPROVED' },
    update: {},
  });
  await prisma.familyMember.deleteMany({ where: { userId: scratchUser.id } });
  await prisma.familyMember.create({
    data: { familyId, userId: scratchUser.id, role: 'MEMBER', displayName: 'Scratch', canSeeMoney: false },
  });

  const originalOwnerId = config.ownerTelegramId;
  try {
    config.ownerTelegramId = String(scratchUser.telegramId);
    const promoted = await FamilyMemberModel.ensureForUser(scratchUser);
    assert.equal(promoted.role, 'OWNER');
    assert.equal(promoted.canSeeMoney, true);

    config.ownerTelegramId = '111111111111';
    const demoted = await FamilyMemberModel.ensureForUser(scratchUser);
    assert.equal(demoted.role, 'MEMBER');
  } finally {
    config.ownerTelegramId = originalOwnerId;
    await prisma.familyMember.deleteMany({ where: { userId: scratchUser.id } });
    await prisma.user.delete({ where: { id: scratchUser.id } });
  }
});
