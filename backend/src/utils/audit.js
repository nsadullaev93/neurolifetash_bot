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

module.exports = { logAudit };
