const SessionModel = require('../models/Session');
const TrainerModel = require('../models/Trainer');
const config = require('../config/default');
const { logAudit } = require('../utils/audit');
const { todayDateOnly, dateOnly, nowYearMonth, formatDateRu } = require('../utils/date');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');

const DONE_STATUSES = ['COMPLETED', 'MAKEUP'];
const NOT_DONE_STATUSES = [
  'TRAINER_ABSENT',
  'CHILD_SICK_CERT',
  'CHILD_SICK_NO_CERT',
  'CHILD_ABSENT',
  'CLOSED_DAY',
  'RESCHEDULED',
];

function serializeSession(session) {
  const effectiveTrainer = session.actualTrainer || session.plannedTrainer;
  return {
    id: session.id,
    date: session.date,
    year: session.year,
    month: session.month,
    startTime: session.startTime,
    endTime: session.endTime,
    status: session.status,
    statusLabel: config.statusLabels[session.status],
    isDone: DONE_STATUSES.includes(session.status),
    note: session.note,
    makeupForSessionId: session.makeupForSessionId,
    plannedTrainer: session.plannedTrainer
      ? { id: session.plannedTrainer.id, name: session.plannedTrainer.name, level: session.plannedTrainer.level }
      : null,
    actualTrainer: session.actualTrainer
      ? { id: session.actualTrainer.id, name: session.actualTrainer.name, level: session.actualTrainer.level }
      : null,
    effectiveTrainer: effectiveTrainer
      ? { id: effectiveTrainer.id, name: effectiveTrainer.name, level: effectiveTrainer.level }
      : null,
    isSubstituted: !!session.actualTrainerId && session.actualTrainerId !== session.plannedTrainerId,
  };
}

async function getToday(req, res, next) {
  try {
    const today = todayDateOnly();
    const sessions = await SessionModel.listForDate(today);
    res.json({
      date: today,
      dateLabel: formatDateRu(today),
      sessions: sessions.map(serializeSession),
    });
  } catch (err) {
    next(err);
  }
}

async function getMonth(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });

    const sessions = await SessionModel.listForMonth(year, month);
    res.json({ year, month, sessions: sessions.map(serializeSession) });
  } catch (err) {
    next(err);
  }
}

async function getUnmarked(req, res, next) {
  try {
    const today = todayDateOnly();
    const sessions = await SessionModel.listUnmarkedBefore(today);
    res.json({ count: sessions.length, sessions: sessions.map(serializeSession) });
  } catch (err) {
    next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const today = todayDateOnly();
    const todaySessions = await SessionModel.listForDate(today);
    const unmarked = await SessionModel.listUnmarkedBefore(today);
    const { year, month } = nowYearMonth();

    // Баланс на «Сегодня» — только для тех, кому владелец открыл деньги
    // (ТЗ v2, §2.14, §5 «Итоговый баланс месяца... для тех, кто видит деньги»).
    const canSeeMoney = !!req.member?.canSeeMoney;
    const reconciliation = canSeeMoney ? await calculateMonthlyReconciliation(year, month) : null;

    res.json({
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      canSeeMoney,
      dateLabel: formatDateRu(today),
      todaySessions: todaySessions.map(serializeSession),
      unmarkedCount: unmarked.length,
      balances: reconciliation ? reconciliation.rows : [],
      totalBalance: reconciliation ? reconciliation.total : null,
      year,
      month,
    });
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    const { id } = req.params;
    const { status, actualTrainerId, note, markDone } = req.body;

    const existing = await SessionModel.findById(id);
    if (!existing) return res.status(404).json({ error: 'Занятие не найдено' });

    const data = {};

    if (markDone === true) {
      data.status = 'COMPLETED';
    } else if (markDone === false) {
      data.status = 'CHILD_ABSENT';
    } else if (status) {
      const allStatuses = [...DONE_STATUSES, ...NOT_DONE_STATUSES, 'PLANNED'];
      if (!allStatuses.includes(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
      }
      data.status = status;
    }

    if (actualTrainerId !== undefined) {
      if (actualTrainerId === null) {
        data.actualTrainerId = null;
      } else {
        const trainer = await TrainerModel.findById(actualTrainerId);
        if (!trainer) return res.status(400).json({ error: 'Специалист не найден' });
        data.actualTrainerId = trainer.id;
      }
    }

    if (note !== undefined) {
      data.note = note;
    }

    // «Кто отметил» (ТЗ v2, §2.14) — только если статус реально поменялся
    // на этот раз, а не просто правится заметка или специалист задним числом.
    if (data.status !== undefined) {
      data.markedByUserId = req.user.id;
      data.markedAt = new Date();
    }

    const updated = await SessionModel.update(id, data);
    await logAudit('Session', id, 'update', existing, updated, req.user.id);

    res.json(serializeSession(updated));
  } catch (err) {
    next(err);
  }
}

async function createMakeup(req, res, next) {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, trainerId } = req.body;

    const original = await SessionModel.findById(id);
    if (!original) return res.status(404).json({ error: 'Занятие не найдено' });

    const trainer = trainerId ? await TrainerModel.findById(trainerId) : original.plannedTrainer;
    if (!trainer) return res.status(400).json({ error: 'Специалист не найден' });

    const [y, m, d] = date.split('-').map(Number);
    const makeupDate = dateOnly(y, m, d);

    const created = await SessionModel.create({
      date: makeupDate,
      year: y,
      month: m,
      startTime: startTime || original.startTime,
      endTime: endTime || original.endTime,
      plannedTrainerId: trainer.id,
      actualTrainerId: trainer.id,
      status: 'MAKEUP',
      makeupForSessionId: original.id,
      markedByUserId: req.user.id,
      markedAt: new Date(),
    });

    await logAudit('Session', created.id, 'create', null, created, req.user.id);

    res.status(201).json(serializeSession(created));
  } catch (err) {
    next(err);
  }
}

async function listTrainers(req, res, next) {
  try {
    const trainers = await TrainerModel.listAll({ onlyActive: true });
    res.json(
      trainers.map((t) => ({
        id: t.id,
        name: t.name,
        level: t.level,
        isActive: t.isActive,
        note: t.note,
        slots: t.slots.filter((s) => s.isActive),
      })),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  serializeSession,
  getToday,
  getMonth,
  getUnmarked,
  getDashboard,
  updateSession,
  createMakeup,
  listTrainers,
};
