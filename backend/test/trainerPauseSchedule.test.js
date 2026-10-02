// Интеграционный тест против реальной продакшен Neon-базы (см.
// invite.test.js/monthGenerator.test.js). Проверяет, что пауза специалиста
// (§2.6.1, 02.10.2026) теперь не только обнуляет план по графику, но и
// убирает/возвращает его занятия в расписании/календаре. Использует
// изолированный "пустой" месяц (2033-07, не пересекается с другими тестами
// или реальной историей) и РЕАЛЬНОГО специалиста "Усмон" (не изолирован —
// в схеме одна семья; не "Ли" — у него в проде уже есть реальная бессрочная
// пауза с 01.10.2026, которая иначе исказила бы тест и на 2033 год),
// полностью убирает за собой всё, что создал.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/default');

if (!process.env.DATABASE_URL) {
  test('пауза специалиста и расписание — пропущено (нет DATABASE_URL)', { skip: true }, () => {});
  return;
}

const prisma = require('../src/database/connection');
const { generateMonth, hideSessionsForPause, restoreSessionsAfterPauseEnd } = require('../src/services/monthGenerator.service');
const { dateOnly } = require('../src/utils/date');
const { getChildId } = require('../src/utils/scope');

after(() => prisma.$disconnect());

const SCRATCH_YEAR = 2033;
const SCRATCH_MONTH = 7;

async function cleanup() {
  const childId = await getChildId();
  await prisma.session.deleteMany({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
  await prisma.trainerPause.deleteMany({
    where: {
      fromDate: { gte: dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 1) },
      toDate: { lte: dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 31) },
    },
  });
}

test('создание паузы убирает занятия специалиста из месяца, удаление паузы их возвращает', async (t) => {
  t.after(cleanup);
  await cleanup();

  const trainer = await prisma.trainer.findFirst({ where: { name: 'Усмон' } });
  assert.ok(trainer, 'в сиде должен быть специалист "Усмон"');

  await generateMonth(SCRATCH_YEAR, SCRATCH_MONTH);
  const childId = await getChildId();
  const before = await prisma.session.count({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.ok(before > 0, 'на чистом месяце по шаблону должны были сгенерироваться занятия специалиста');

  const fromDate = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 1);
  const toDate = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 31);
  const pause = await prisma.trainerPause.create({ data: { trainerId: trainer.id, fromDate, toDate, note: 'test' } });

  await hideSessionsForPause(trainer.id, fromDate, toDate);
  const duringPause = await prisma.session.count({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.equal(duringPause, 0, 'на период паузы занятия специалиста должны полностью исчезнуть');

  // Повторная генерация месяца (как ночной cron) не должна их вернуть, пока пауза активна.
  await generateMonth(SCRATCH_YEAR, SCRATCH_MONTH);
  const stillHidden = await prisma.session.count({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.equal(stillHidden, 0, 'generateMonth не должна создавать занятия на период активной паузы');

  await prisma.trainerPause.delete({ where: { id: pause.id } });
  await restoreSessionsAfterPauseEnd(trainer.id, fromDate, toDate, { year: SCRATCH_YEAR, month: SCRATCH_MONTH });
  const afterRestore = await prisma.session.count({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.equal(afterRestore, before, 'после удаления паузы занятия должны вернуться в прежнем количестве');
});

test('пауза не трогает уже отмеченные занятия специалиста', async (t) => {
  t.after(cleanup);
  await cleanup();

  const trainer = await prisma.trainer.findFirst({ where: { name: 'Усмон' } });
  await generateMonth(SCRATCH_YEAR, SCRATCH_MONTH);
  const childId = await getChildId();

  const someSession = await prisma.session.findFirst({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH, plannedTrainerId: trainer.id } });
  assert.ok(someSession, 'ожидалось хотя бы одно занятие для проверки');
  await prisma.session.update({ where: { id: someSession.id }, data: { status: 'COMPLETED' } });

  const fromDate = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 1);
  const toDate = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 31);
  await hideSessionsForPause(trainer.id, fromDate, toDate);

  const stillThere = await prisma.session.findUnique({ where: { id: someSession.id } });
  assert.ok(stillThere, 'уже отмеченное (COMPLETED) занятие не должно удаляться паузой');
  assert.equal(stillThere.status, 'COMPLETED');
});
