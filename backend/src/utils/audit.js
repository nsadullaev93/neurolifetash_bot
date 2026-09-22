const prisma = require('../database/connection');
const { getFamilyId } = require('./scope');

async function logAudit(entity, entityId, action, oldValue, newValue, userId) {
  try {
    const familyId = await getFamilyId();
    await prisma.auditLog.create({
      data: {
        familyId,
        userId: userId ?? null,
        entity,
        entityId: Number(entityId),
        action,
        oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
        newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue)),
      },
    });
  } catch (err) {
    console.error('Не удалось записать AuditLog:', err.message);
  }
}

// Читает историю изменений (аудит надёжности, фаза 7) — AuditLog писался
// при каждом изменении занятия/оплаты с самого начала ТЗ v2, но нигде не
// читался обратно: ни страницы в Admin Panel, ни команды в боте. Имя
// пользователя резолвится отдельным запросом, а не через Prisma-relation —
// в схеме AuditLog.userId намеренно простое Int (запись должна сохраняться,
// даже если пользователь потом будет удалён).
async function listRecent(limit = 100) {
  const familyId = await getFamilyId();
  const rows = await prisma.auditLog.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const userIds = [...new Set(rows.map((r) => r.userId).filter((id) => id != null))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entityId,
    action: r.action,
    oldValue: r.oldValue,
    newValue: r.newValue,
    createdAt: r.createdAt,
    userName: r.userId != null ? userById.get(r.userId)?.firstName || `#${r.userId}` : null,
  }));
}

module.exports = { logAudit, listRecent };
