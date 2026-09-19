const prisma = require('../database/connection');

async function logAudit(entity, entityId, action, oldValue, newValue) {
  try {
    await prisma.auditLog.create({
      data: {
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
