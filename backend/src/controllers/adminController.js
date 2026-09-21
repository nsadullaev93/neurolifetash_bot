const jwt = require('jsonwebtoken');
const prisma = require('../database/connection');
const config = require('../config/default');
const LevelModel = require('../models/Level');
const TrainerModel = require('../models/Trainer');
const ScheduleSlotModel = require('../models/ScheduleSlot');
const ClosedDayModel = require('../models/ClosedDay');
const PaymentModel = require('../models/Payment');
const UserModel = require('../models/User');
const SessionModel = require('../models/Session');
const { generateMonth, regenerateFromDate } = require('../services/monthGenerator.service');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');
const { calculateForecast } = require('../services/forecast.service');
const { getMonthlyReport, exportMonthlyXlsx } = require('../services/report.service');
const { logAudit } = require('../utils/audit');
const { serializeSession } = require('./sessionController');
const { serializePayment } = require('./paymentController');
const { nowYearMonth, dateOnly, todayDateOnly } = require('../utils/date');

// ---------- auth ----------

async function login(req, res) {
  const { password } = req.body;
  if (password !== config.adminPassword) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  const token = jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '30d' });
  res.json({ token });
}

// ---------- dashboard ----------

async function dashboard(req, res, next) {
  try {
    const { year, month } = nowYearMonth();
    const [reconciliation, unmarked, sessions] = await Promise.all([
      calculateMonthlyReconciliation(year, month),
      SessionModel.listUnmarkedBefore(todayDateOnly()),
      SessionModel.listForMonth(year, month),
    ]);

    const completed = sessions.filter((s) => ['COMPLETED', 'MAKEUP'].includes(s.status)).length;
    const missed = sessions.filter((s) =>
      !['COMPLETED', 'MAKEUP', 'PLANNED'].includes(s.status),
    ).length;

    res.json({
      year,
      month,
      totalSessions: sessions.length,
      completed,
      missed,
      totalBalance: reconciliation.total,
      balances: reconciliation.rows,
      unmarkedCount: unmarked.length,
      unmarked: unmarked.slice(0, 10).map(serializeSession),
    });
  } catch (err) {
    next(err);
  }
}

// ---------- levels ----------

async function listLevels(req, res, next) {
  try {
    res.json(await LevelModel.listAll());
  } catch (err) {
    next(err);
  }
}

async function createLevel(req, res, next) {
  try {
    const { code, name, rate } = req.body;
    const created = await LevelModel.create({ code, name, rate: Number(rate) });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function updateLevel(req, res, next) {
  try {
    const existing = await LevelModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Уровень не найден' });

    const { name, rate } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (rate !== undefined) data.rate = Number(rate);

    const updated = await LevelModel.update(req.params.id, data);
    await logAudit('Level', req.params.id, 'update', existing, updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteLevel(req, res, next) {
  try {
    await LevelModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------- trainers ----------

async function listTrainers(req, res, next) {
  try {
    res.json(await TrainerModel.listAll());
  } catch (err) {
    next(err);
  }
}

async function createTrainer(req, res, next) {
  try {
    const { name, levelId, isActive, note } = req.body;
    const created = await TrainerModel.create({
      name,
      levelId: Number(levelId),
      isActive: isActive !== undefined ? isActive : true,
      note: note || null,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function updateTrainer(req, res, next) {
  try {
    const existing = await TrainerModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Специалист не найден' });

    const { name, levelId, isActive, note } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (levelId !== undefined) data.levelId = Number(levelId);
    if (isActive !== undefined) data.isActive = isActive;
    if (note !== undefined) data.note = note;

    const updated = await TrainerModel.update(req.params.id, data);
    await logAudit('Trainer', req.params.id, 'update', existing, updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteTrainer(req, res, next) {
  try {
    await TrainerModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------- schedule slots ----------

async function listSlots(req, res, next) {
  try {
    res.json(await ScheduleSlotModel.listAll());
  } catch (err) {
    next(err);
  }
}

async function createSlot(req, res, next) {
  try {
    const { trainerId, weekday, startTime, endTime, isActive } = req.body;
    const created = await ScheduleSlotModel.create({
      trainerId: Number(trainerId),
      weekday: Number(weekday),
      startTime,
      endTime,
      isActive: isActive !== undefined ? isActive : true,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function updateSlot(req, res, next) {
  try {
    const existing = await ScheduleSlotModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Слот не найден' });

    const { weekday, startTime, endTime, isActive } = req.body;
    const data = {};
    if (weekday !== undefined) data.weekday = Number(weekday);
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await ScheduleSlotModel.update(req.params.id, data);
    await logAudit('ScheduleSlot', req.params.id, 'update', existing, updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteSlot(req, res, next) {
  try {
    await ScheduleSlotModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------- sessions ----------

async function listSessions(req, res, next) {
  try {
    const { year, month, trainerId, status } = req.query;
    const where = {};
    if (year) where.year = Number(year);
    if (month) where.month = Number(month);
    if (status) where.status = status;
    if (trainerId) {
      where.OR = [{ plannedTrainerId: Number(trainerId) }, { actualTrainerId: Number(trainerId) }];
    }

    const sessions = await prisma.session.findMany({
      where,
      include: { plannedTrainer: { include: { level: true } }, actualTrainer: { include: { level: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(sessions.map(serializeSession));
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const { date, startTime, endTime, plannedTrainerId, status } = req.body;
    const [y, m, d] = date.split('-').map(Number);
    const dateValue = dateOnly(y, m, d);

    const created = await SessionModel.create({
      date: dateValue,
      year: y,
      month: m,
      startTime,
      endTime,
      plannedTrainerId: Number(plannedTrainerId),
      status: status || 'PLANNED',
    });

    await logAudit('Session', created.id, 'create', null, created);
    res.status(201).json(serializeSession(created));
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    const existing = await SessionModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Занятие не найдено' });

    const { status, actualTrainerId, note, startTime, endTime } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (actualTrainerId !== undefined) data.actualTrainerId = actualTrainerId === null ? null : Number(actualTrainerId);
    if (note !== undefined) data.note = note;
    if (startTime !== undefined) data.startTime = startTime;
    if (endTime !== undefined) data.endTime = endTime;

    const updated = await SessionModel.update(req.params.id, data);
    await logAudit('Session', req.params.id, 'update', existing, updated);
    res.json(serializeSession(updated));
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    await SessionModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function bulkUpdateSessions(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      return res.status(400).json({ error: 'Укажите ids и status' });
    }
    await prisma.session.updateMany({ where: { id: { in: ids.map(Number) } }, data: { status } });
    await logAudit('Session', 0, 'bulk-update', null, { ids, status });
    res.json({ updated: ids.length });
  } catch (err) {
    next(err);
  }
}

// ---------- payments ----------

async function listPayments(req, res, next) {
  try {
    res.json((await PaymentModel.listAll()).map(serializePayment));
  } catch (err) {
    next(err);
  }
}

async function createPayment(req, res, next) {
  try {
    const { year, month, trainerId, paidSessions, totalAmount, note } = req.body;
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) return res.status(400).json({ error: 'Специалист не найден' });

    const rateSnapshot = trainer.level.rate;
    const total = totalAmount !== undefined ? Number(totalAmount) : Number(paidSessions) * rateSnapshot;

    const created = await PaymentModel.create({
      year: Number(year),
      month: Number(month),
      trainerId: Number(trainerId),
      paidSessions: Number(paidSessions),
      rateSnapshot,
      totalAmount: total,
      note: note || null,
    });

    await logAudit('MonthlyPayment', created.id, 'create', null, created);
    res.status(201).json(serializePayment(created));
  } catch (err) {
    next(err);
  }
}

async function updatePayment(req, res, next) {
  try {
    const existing = await PaymentModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Оплата не найдена' });

    const { paidSessions, totalAmount, rateSnapshot, note } = req.body;
    const data = {};
    if (paidSessions !== undefined) data.paidSessions = Number(paidSessions);
    if (totalAmount !== undefined) data.totalAmount = Number(totalAmount);
    if (rateSnapshot !== undefined) data.rateSnapshot = Number(rateSnapshot);
    if (note !== undefined) data.note = note;

    const updated = await PaymentModel.update(req.params.id, data);
    await logAudit('MonthlyPayment', req.params.id, 'update', existing, updated);
    res.json(serializePayment(updated));
  } catch (err) {
    next(err);
  }
}

async function deletePayment(req, res, next) {
  try {
    await PaymentModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------- closed days ----------

async function listClosedDays(req, res, next) {
  try {
    res.json(await ClosedDayModel.listAll());
  } catch (err) {
    next(err);
  }
}

async function createClosedDay(req, res, next) {
  try {
    const { date, title } = req.body;
    const [y, m, d] = date.split('-').map(Number);
    const dateValue = dateOnly(y, m, d);

    const created = await ClosedDayModel.createAndCancelSessions(dateValue, title || 'Праздник');

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function deleteClosedDay(req, res, next) {
  try {
    const existing = await prisma.closedDay.findUnique({ where: { id: Number(req.params.id) } });
    if (existing) {
      await prisma.session.updateMany({
        where: { date: existing.date, status: 'CLOSED_DAY' },
        data: { status: 'PLANNED' },
      });
    }
    await ClosedDayModel.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ---------- users ----------

async function listUsers(req, res, next) {
  try {
    const users = await UserModel.listAll();
    res.json(users.map((u) => ({ ...u, telegramId: u.telegramId.toString() })));
  } catch (err) {
    next(err);
  }
}

// ---------- generate month ----------

async function generateMonthHandler(req, res, next) {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });
    const result = await generateMonth(Number(year), Number(month));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// «Применить с даты…» на странице «Шаблон расписания» (ТЗ v2, §2.18) —
// пересоздаёт будущие ещё не отмеченные занятия по обновлённому шаблону;
// уже отмеченные занятия не трогает.
async function applyScheduleFromDate(req, res, next) {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Укажите date (YYYY-MM-DD)' });
    const [y, m, d] = date.split('-').map(Number);
    const result = await regenerateFromDate(dateOnly(y, m, d));
    await logAudit('ScheduleSlot', 0, 'apply-from-date', null, { date, ...result });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------- reports ----------

async function monthlyReport(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });
    res.json(await getMonthlyReport(year, month));
  } catch (err) {
    next(err);
  }
}

async function forecastReport(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });
    res.json(await calculateForecast(year, month));
  } catch (err) {
    next(err);
  }
}

async function exportMonthlyReport(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });
    const buffer = await exportMonthlyXlsx(year, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-${year}-${String(month).padStart(2, '0')}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  dashboard,
  monthlyReport,
  forecastReport,
  exportMonthlyReport,
  listLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  listTrainers,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  listSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  applyScheduleFromDate,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  bulkUpdateSessions,
  listPayments,
  createPayment,
  updatePayment,
  deletePayment,
  listClosedDays,
  createClosedDay,
  deleteClosedDay,
  listUsers,
  generateMonthHandler,
};
