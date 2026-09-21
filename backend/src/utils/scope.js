const prisma = require('../database/connection');

// ТЗ v2, §3: схема готова к нескольким семьям на будущее, но регистрация
// новых семей не делается — в системе всегда ровно одна Family и один
// Child (см. миграцию 20260921150000_add_family_v2). Эти значения
// читаются один раз и кэшируются на весь процесс.
let familyId = null;
let childId = null;

async function getFamilyId() {
  if (familyId !== null) return familyId;
  const family = await prisma.family.findFirstOrThrow();
  familyId = family.id;
  return familyId;
}

async function getChildId() {
  if (childId !== null) return childId;
  const child = await prisma.child.findFirstOrThrow();
  childId = child.id;
  return childId;
}

module.exports = { getFamilyId, getChildId };
