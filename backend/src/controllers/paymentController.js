const PaymentModel = require('../models/Payment');
const TrainerModel = require('../models/Trainer');
const { logAudit } = require('../utils/audit');

function serializePayment(payment) {
  return {
    id: payment.id,
    year: payment.year,
    month: payment.month,
    trainerId: payment.trainerId,
    trainerName: payment.trainer ? payment.trainer.name : undefined,
    levelName: payment.trainer ? payment.trainer.level.name : undefined,
    paidSessions: payment.paidSessions,
    rateSnapshot: payment.rateSnapshot,
    totalAmount: payment.totalAmount,
    paidAt: payment.paidAt,
    note: payment.note,
  };
}

async function listMonth(req, res, next) {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month) return res.status(400).json({ error: 'Укажите year и month' });

    const payments = await PaymentModel.listForMonth(year, month);
    res.json(payments.map(serializePayment));
  } catch (err) {
    next(err);
  }
}

async function listHistory(req, res, next) {
  try {
    const payments = await PaymentModel.listAll();
    res.json(payments.map(serializePayment));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { year, month, trainerId, paidSessions, totalAmount, note } = req.body;
    if (!year || !month || !trainerId || paidSessions === undefined) {
      return res.status(400).json({ error: 'Укажите year, month, trainerId и paidSessions' });
    }

    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) return res.status(400).json({ error: 'Специалист не найден' });

    // За месяц одному специалисту можно внести несколько оплат (ТЗ v2, §2.10) —
    // формула сверки их суммирует, поэтому повторная оплата не блокируется.
    const rateSnapshot = trainer.level.rate;
    const total = totalAmount !== undefined ? totalAmount : paidSessions * rateSnapshot;

    const created = await PaymentModel.create({
      year,
      month,
      trainerId: trainer.id,
      paidSessions,
      rateSnapshot,
      totalAmount: total,
      note,
    });

    await logAudit('MonthlyPayment', created.id, 'create', null, created);

    res.status(201).json(serializePayment(created));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await PaymentModel.findById(id);
    if (!existing) return res.status(404).json({ error: 'Оплата не найдена' });

    const { paidSessions, totalAmount, note } = req.body;
    const data = {};
    if (paidSessions !== undefined) data.paidSessions = paidSessions;
    if (totalAmount !== undefined) data.totalAmount = totalAmount;
    if (note !== undefined) data.note = note;

    const updated = await PaymentModel.update(id, data);
    await logAudit('MonthlyPayment', id, 'update', existing, updated);

    res.json(serializePayment(updated));
  } catch (err) {
    next(err);
  }
}

module.exports = { serializePayment, listMonth, listHistory, create, update };
