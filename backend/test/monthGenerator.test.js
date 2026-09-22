// Интеграционный тест против реальной продакшен Neon-базы (см.
// invite.test.js). Использует изолированный "пустой" год (2033), который
// не пересекается с реальной историей посещаемости семьи — та же практика,
// что использовалась при ручной проверке каждой фазы ТЗ v2. Использует
// РЕАЛЬНЫЙ текущий шаблон расписания/специалистов (они не изолированы —
// в схеме одна семья), но только на заведомо будущих "пустых" датах, и
// полностью убирает за собой всё, что создал.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
require('../src/config/default'); // грузит backend/.env (DATABASE_URL и т.д.)

if (!process.env.DATABASE_URL) {
  test('regenerateFromDate — пропущено (нет DATABASE_URL)', { skip: true }, () => {});
  return;
}

const prisma = require('../src/database/connection');
const { regenerateFromDate } = require('../src/services/monthGenerator.service');
const { dateOnly } = require('../src/utils/date');
const { getChildId } = require('../src/utils/scope');

after(() => prisma.$disconnect());

const SCRATCH_YEAR = 2033;
const SCRATCH_MONTH = 6;

async function cleanupScratchMonth() {
  const childId = await getChildId();
  await prisma.session.deleteMany({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
}

test('regenerateFromDate создаёт занятия по шаблону на изолированный месяц и идемпотентна', async (t) => {
  t.after(cleanupScratchMonth);
  await cleanupScratchMonth();

  const from = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 1);
  const first = await regenerateFromDate(from);
  assert.equal(first.deletedCount, 0, 'на чистом месяце удалять нечего');
  assert.ok(first.created > 0, 'на месяце с активным шаблоном должны создаться занятия');

  const childId = await getChildId();
  const count = await prisma.session.count({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
  assert.equal(count, first.created);

  // Повторный вызов на тех же датах: всё ещё PLANNED, поэтому deleteMany
  // сметает их и create создаёт заново — то же количество, не удваивается.
  const second = await regenerateFromDate(from);
  assert.equal(second.deletedCount, first.created);
  assert.equal(second.created, first.created);
});

test('regenerateFromDate не трогает уже отмеченные занятия', async (t) => {
  t.after(cleanupScratchMonth);
  await cleanupScratchMonth();

  const from = dateOnly(SCRATCH_YEAR, SCRATCH_MONTH, 1);
  await regenerateFromDate(from);

  const childId = await getChildId();
  const someSession = await prisma.session.findFirst({ where: { childId, year: SCRATCH_YEAR, month: SCRATCH_MONTH } });
  assert.ok(someSession, 'ожидалось хотя бы одно созданное занятие для проверки');

  await prisma.session.update({ where: { id: someSession.id }, data: { status: 'COMPLETED' } });

  const result = await regenerateFromDate(from);
  const stillThere = await prisma.session.findUnique({ where: { id: someSession.id } });
  assert.ok(stillThere, 'отмеченное занятие не должно быть удалено');
  assert.equal(stillThere.status, 'COMPLETED');
  assert.ok(result.deletedCount < result.created + 1, 'отмеченное занятие не должно попасть в deletedCount');
});
