const PaymentModel = require('../models/Payment');
const TrainerModel = require('../models/Trainer');
const { logAudit } = require('../utils/audit');
const { canApplyDiscount, rateWithDiscount } = require('../utils/discount');
const config = require('../config/default');

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
    discountApplied: payment.discountApplied,
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
    const { year, month, trainerId, paidSessions, totalAmount, note, discountApplied } = req.body;
    if (!year || !month || !trainerId || paidSessions === undefined) {
      return res.status(400).json({ error: 'Укажите year, month, trainerId и paidSessions' });
    }

    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) return res.status(400).json({ error: 'Специалист не найден' });

    const wantsDiscount = !!discountApplied;
    if (wantsDiscount && !canApplyDiscount(paidSessions)) {
      return res.status(400).json({
        error: `Скидка доступна только при оплате более ${config.discountThresholdSessions} занятий в месяц`,
      });
    }

    // За месяц одному специалисту можно внести несколько оплат (ТЗ v2, §2.10) —
    // формула сверки их суммирует, поэтому повторная оплата не блокируется.
    // rateSnapshot уже содержит эффективную (со скидкой или без) ставку —
    // дальше по цепочке (сверка, отчёт, PDF) ничего специально знать про
    // скидку не должно, кроме отображения флага discountApplied.
    const rateSnapshot = rateWithDiscount(trainer.level.rate, wantsDiscount);
    const total = totalAmount !== undefined ? totalAmount : paidSessions * rateSnapshot;

    const created = await PaymentModel.create({
      year,
      month,
      trainerId: trainer.id,
      paidSessions,
      rateSnapshot,
      totalAmount: total,
      discountApplied: wantsDiscount,
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

    const { paidSessions, totalAmount, note, discountApplied } = req.body;
    const data = {};
    if (paidSessions !== undefined) data.paidSessions = paidSessions;
    if (totalAmount !== undefined) data.totalAmount = totalAmount;
    if (note !== undefined) data.note = note;

    if (discountApplied !== undefined) {
      const effectivePaidSessions = paidSessions !== undefined ? paidSessions : existing.paidSessions;
      if (discountApplied && !canApplyDiscount(effectivePaidSessions)) {
        return res.status(400).json({
          error: `Скидка доступна только при оплате более ${config.discountThresholdSessions} занятий в месяц`,
        });
      }
      const trainer = await TrainerModel.findById(existing.trainerId);
      data.discountApplied = discountApplied;
      data.rateSnapshot = rateWithDiscount(trainer.level.rate, discountApplied);
      if (totalAmount === undefined) data.totalAmount = effectivePaidSessions * data.rateSnapshot;
    }

    const updated = await PaymentModel.update(id, data);
    await logAudit('MonthlyPayment', id, 'update', existing, updated);

    res.json(serializePayment(updated));
  } catch (err) {
    next(err);
  }
}

module.exports = { serializePayment, listMonth, listHistory, create, update };
