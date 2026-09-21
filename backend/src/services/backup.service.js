'use strict';

// Резервная копия данных семьи в JSON (ТЗ v2, §2.18). Без токенов и
// паролей — их в БД и нет, BOT_TOKEN/ADMIN_PASSWORD/JWT_SECRET это только
// переменные окружения. Каждый ряд восстанавливается по своему исходному
// id (upsert), поэтому восстановление идемпотентно и безопасно повторно
// запускать: удалённые записи вернутся, уже существующие — обновятся.
const prisma = require('../database/connection');
const { getFamilyId } = require('../utils/scope');

function serializeBigInt(value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function serializeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = serializeBigInt(v);
  return out;
}

async function createBackup() {
  const familyId = await getFamilyId();

  const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
  const children = await prisma.child.findMany({ where: { familyId } });
  const childIds = children.map((c) => c.id);

  const familyMembers = await prisma.familyMember.findMany({ where: { familyId } });
  const userIds = [...new Set(familyMembers.map((m) => m.userId))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];

  const levels = await prisma.level.findMany({ where: { familyId } });
  const trainers = await prisma.trainer.findMany({ where: { familyId } });
  const trainerIds = trainers.map((t) => t.id);
  const scheduleSlots = childIds.length ? await prisma.scheduleSlot.findMany({ where: { childId: { in: childIds } } }) : [];
  const sessions = childIds.length ? await prisma.session.findMany({ where: { childId: { in: childIds } } }) : [];
  const sessionIds = sessions.map((s) => s.id);
  const holidays = await prisma.holiday.findMany({ where: { familyId } });
  const closedDays = await prisma.closedDay.findMany({ where: { familyId } });
  const monthlyPayments = trainerIds.length
    ? await prisma.monthlyPayment.findMany({ where: { trainerId: { in: trainerIds } } })
    : [];
  const settlements = trainerIds.length ? await prisma.settlement.findMany({ where: { trainerId: { in: trainerIds } } }) : [];
  const sessionNotes = sessionIds.length ? await prisma.sessionNote.findMany({ where: { sessionId: { in: sessionIds } } }) : [];

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    family: serializeRow(family),
    children: children.map(serializeRow),
    users: users.map(serializeRow),
    familyMembers: familyMembers.map(serializeRow),
    levels: levels.map(serializeRow),
    trainers: trainers.map(serializeRow),
    scheduleSlots: scheduleSlots.map(serializeRow),
    sessions: sessions.map(serializeRow),
    holidays: holidays.map(serializeRow),
    closedDays: closedDays.map(serializeRow),
    monthlyPayments: monthlyPayments.map(serializeRow),
    settlements: settlements.map(serializeRow),
    sessionNotes: sessionNotes.map(serializeRow),
  };
}

function toDate(v) {
  return v == null ? v : new Date(v);
}

// Восстанавливает каждую строку по её исходному id (upsert) — в порядке,
// уважающем внешние ключи. Оборачивается в транзакцию вызывающей стороной.
async function restoreBackup(tx, backup) {
  if (!backup || backup.version !== 1) {
    throw new Error('Неизвестный формат файла бэкапа');
  }

  const upsert = async (model, rows, mapData) => {
    for (const row of rows) {
      const data = mapData(row);
      await tx[model].upsert({ where: { id: row.id }, update: data, create: { id: row.id, ...data } });
    }
  };

  await upsert('family', [backup.family], (r) => ({ name: r.name, createdAt: toDate(r.createdAt) }));

  await upsert('child', backup.children, (r) => ({
    familyId: r.familyId,
    name: r.name,
    isActive: r.isActive,
  }));

  await upsert('user', backup.users, (r) => ({
    telegramId: BigInt(r.telegramId),
    firstName: r.firstName,
    lastName: r.lastName,
    username: r.username,
    phone: r.phone,
    isAdmin: r.isAdmin,
    remindersOn: r.remindersOn,
    reminderTime: r.reminderTime,
    accessStatus: r.accessStatus,
    createdAt: toDate(r.createdAt),
  }));

  await upsert('familyMember', backup.familyMembers, (r) => ({
    familyId: r.familyId,
    userId: r.userId,
    role: r.role,
    displayName: r.displayName,
    canSeeMoney: r.canSeeMoney,
    sessionPings: r.sessionPings,
    paymentPings: r.paymentPings,
    theme: r.theme,
    joinedAt: toDate(r.joinedAt),
  }));

  await upsert('level', backup.levels, (r) => ({
    familyId: r.familyId,
    code: r.code,
    name: r.name,
    rate: r.rate,
    updatedAt: toDate(r.updatedAt),
  }));

  await upsert('trainer', backup.trainers, (r) => ({
    familyId: r.familyId,
    name: r.name,
    levelId: r.levelId,
    color: r.color,
    isActive: r.isActive,
    note: r.note,
    createdAt: toDate(r.createdAt),
  }));

  await upsert('scheduleSlot', backup.scheduleSlots, (r) => ({
    trainerId: r.trainerId,
    childId: r.childId,
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
    isActive: r.isActive,
    createdAt: toDate(r.createdAt),
  }));

  await upsert('session', backup.sessions, (r) => ({
    childId: r.childId,
    date: toDate(r.date),
    year: r.year,
    month: r.month,
    startTime: r.startTime,
    endTime: r.endTime,
    plannedTrainerId: r.plannedTrainerId,
    actualTrainerId: r.actualTrainerId,
    status: r.status,
    note: r.note,
    makeupForSessionId: r.makeupForSessionId,
    markedByUserId: r.markedByUserId,
    markedAt: toDate(r.markedAt),
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  }));

  await upsert('holiday', backup.holidays, (r) => ({
    familyId: r.familyId,
    date: toDate(r.date),
    title: r.title,
    status: r.status,
  }));

  await upsert('closedDay', backup.closedDays, (r) => ({
    familyId: r.familyId,
    date: toDate(r.date),
    title: r.title,
  }));

  await upsert('monthlyPayment', backup.monthlyPayments, (r) => ({
    year: r.year,
    month: r.month,
    trainerId: r.trainerId,
    paidSessions: r.paidSessions,
    rateSnapshot: r.rateSnapshot,
    totalAmount: r.totalAmount,
    paidAt: toDate(r.paidAt),
    enteredByUserId: r.enteredByUserId,
    note: r.note,
  }));

  await upsert('settlement', backup.settlements, (r) => ({
    year: r.year,
    month: r.month,
    trainerId: r.trainerId,
    balance: r.balance,
    centerConducted: r.centerConducted,
    agreedConducted: r.agreedConducted,
    status: r.status,
    paidAmount: r.paidAmount,
    paidAt: toDate(r.paidAt),
    carriedToYear: r.carriedToYear,
    carriedToMonth: r.carriedToMonth,
    updatedAt: toDate(r.updatedAt),
  }));

  await upsert('sessionNote', backup.sessionNotes, (r) => ({
    sessionId: r.sessionId,
    authorUserId: r.authorUserId,
    text: r.text,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  }));

  return {
    children: backup.children.length,
    users: backup.users.length,
    familyMembers: backup.familyMembers.length,
    levels: backup.levels.length,
    trainers: backup.trainers.length,
    scheduleSlots: backup.scheduleSlots.length,
    sessions: backup.sessions.length,
    holidays: backup.holidays.length,
    closedDays: backup.closedDays.length,
    monthlyPayments: backup.monthlyPayments.length,
    settlements: backup.settlements.length,
    sessionNotes: backup.sessionNotes.length,
  };
}

async function restoreBackupTransaction(backup) {
  // Восстановление идёт построчно (upsert за upsert'ом) — при заметном
  // объёме данных легко выйти за дефолтный таймаут интерактивной
  // транзакции Prisma (5 секунд), особенно с учётом сетевой задержки до Neon.
  return prisma.$transaction((tx) => restoreBackup(tx, backup), { timeout: 120000, maxWait: 15000 });
}

module.exports = { createBackup, restoreBackupTransaction };
