// Интеграционный тест против реальной (единственной) продакшен Neon-базы —
// в проекте нет отдельной тестовой БД (single-tenant приложение, схема
// завязана на одну Family/Child через utils/scope.js). Безопасно
// повторяемый: создаёт и полностью удаляет за собой один Invite; ничего
// в реальных данных семьи не трогает. Требует настоящего DATABASE_URL
// (как и остальной backend/.env) — пропускается, если он не задан.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/default'); // грузит backend/.env (DATABASE_URL и т.д.)

if (!process.env.DATABASE_URL) {
  test('invite.claim — пропущено (нет DATABASE_URL)', { skip: true }, () => {});
  return;
}

const prisma = require('../src/database/connection');
const InviteModel = require('../src/models/Invite');

after(() => prisma.$disconnect());

test('claim() — ровно одна победа из двух параллельных попыток по одному коду', async () => {
  const invite = await InviteModel.create(1);
  try {
    const [a, b] = await Promise.all([InviteModel.claim(invite.code), InviteModel.claim(invite.code)]);
    const successes = [a, b].filter(Boolean).length;
    assert.equal(successes, 1, 'ровно одна из двух параллельных попыток должна победить');

    const third = await InviteModel.claim(invite.code);
    assert.equal(third, null, 'использованный код больше не должен claim-иться');
  } finally {
    await prisma.invite.deleteMany({ where: { id: invite.id } });
  }
});

test('diagnoseFailure различает причины отказа', async () => {
  assert.match(await InviteModel.diagnoseFailure('does-not-exist-xyz'), /не найдена/);

  const used = await InviteModel.create(1);
  await InviteModel.claim(used.code);
  try {
    assert.match(await InviteModel.diagnoseFailure(used.code), /уже использована/);
  } finally {
    await prisma.invite.deleteMany({ where: { id: used.id } });
  }

  const family = await prisma.family.findFirstOrThrow();
  const expired = await prisma.invite.create({
    data: { familyId: family.id, code: 'test-expired-invite-code', expiresAt: new Date(Date.now() - 1000), createdById: 1 },
  });
  try {
    assert.match(await InviteModel.diagnoseFailure(expired.code), /истёк/);
  } finally {
    await prisma.invite.deleteMany({ where: { id: expired.id } });
  }
});
