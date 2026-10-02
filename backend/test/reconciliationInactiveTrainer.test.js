// Интеграционный тест против реальной продакшен Neon-базы (см.
// invite.test.js/monthGenerator.test.js). Регрессия 03.10.2026: деактивация
// специалиста (Admin Panel → Специалисты → «Отключить») стирала его из
// сверки/отчёта за уже ЗАКРЫТЫЕ месяцы, где у него реально были занятия и
// оплата — "план по графику" брался только из текущих активных специалистов.
// Использует изолированный "пустой" месяц (2033-08) и РЕАЛЬНОГО специалиста
// "Усмон" (не "Ли" — у него в проде реальная пауза), временно деактивируя
// и гарантированно возвращая его исходный статус в конце.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/default');

if (!process.env.DATABASE_URL) {
  test('сверка и деактивированный специалист — пропущено (нет DATABASE_URL)', { skip: true }, () => {});
  return;
}

const prisma = require('../src/database/connection');
const { generateMonth } = require('../src/services/monthGenerator.service');
const { calculateMonthlyReconciliation } = require('../src/services/reconciliation.service');
const { getChildId } = require('../src/utils/scope');

after(() => prisma.$disconnect());

const SCRATCH_YEAR = 2033;
const SCRATCH_MONTH = 8;

async function cleanup() {
  const childId = await getChildId();
  await prisma.session.deleteMany({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
  await prisma.monthlyPayment.deleteMany({ where: { year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
}

test('деактивация специалиста не стирает его из сверки за уже прошедший месяц', async (t) => {
  await cleanup();

  const trainer = await prisma.trainer.findFirst({ where: { name: 'Усмон' } });
  assert.ok(trainer, 'в сиде должен быть специалист "Усмон"');
  assert.equal(trainer.isActive, true, 'перед тестом специалист должен быть активен');

  t.after(async () => {
    await cleanup();
    await prisma.trainer.update({ where: { id: trainer.id }, data: { isActive: true } });
  });

  await generateMonth(SCRATCH_YEAR, SCRATCH_MONTH);
  const childId = await getChildId();
  const someSession = await prisma.session.findFirst({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.ok(someSession, 'ожидалось хотя бы одно занятие для проверки');
  await prisma.session.update({ where: { id: someSession.id }, data: { status: 'COMPLETED' } });

  const level = await prisma.level.findUnique({ where: { id: trainer.levelId } });
  await prisma.monthlyPayment.create({
    data: {
      year: SCRATCH_YEAR,
      month: SCRATCH_MONTH,
      trainerId: trainer.id,
      paidSessions: 10,
      rateSnapshot: level.rate,
      totalAmount: 10 * level.rate,
    },
  });

  const before = await calculateMonthlyReconciliation(SCRATCH_YEAR, SCRATCH_MONTH);
  const rowBefore = before.rows.find((r) => r.trainerId === trainer.id);
  assert.ok(rowBefore, 'строка специалиста должна быть в сверке, пока он активен');

  await prisma.trainer.update({ where: { id: trainer.id }, data: { isActive: false } });

  const after_ = await calculateMonthlyReconciliation(SCRATCH_YEAR, SCRATCH_MONTH);
  const rowAfter = after_.rows.find((r) => r.trainerId === trainer.id);
  assert.ok(rowAfter, 'строка специалиста НЕ должна исчезать из сверки за прошедший месяц после деактивации');
  assert.equal(rowAfter.paid, rowBefore.paid);
  assert.equal(rowAfter.completed, rowBefore.completed);
  assert.equal(rowAfter.balance, rowBefore.balance);
});
