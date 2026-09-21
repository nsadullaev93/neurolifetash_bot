const SettlementModel = require('../models/Settlement');
const { calculateMonthlyReconciliation } = require('./reconciliation.service');
const { nextMonthOf } = require('../utils/date');

// Закрытие месяца (ТЗ v2, §2.9). Вызывается раз в месяц, в последний день,
// после того как посчитан баланс. Идемпотентно: существующие PAID_SEPARATELY
// и CARRIED_OVER решения не трогает (пользователь мог уже отреагировать
// раньше, если баланс было видно заранее).
//
//   баланс > 0 (переплата)  -> CARRIED_OVER сразу, без решения пользователя
//   баланс < 0 (доплата)    -> OPEN, ждёт кнопку в боте
//   баланс = 0              -> CLOSED
//
// Возвращает список специалистов с доплатой, ожидающих решения (для кнопок).
async function closeMonth(year, month) {
  const report = await calculateMonthlyReconciliation(year, month);
  const { year: carryYear, month: carryMonth } = nextMonthOf(year, month);
  const pendingDecisions = [];

  for (const row of report.rows) {
    const existing = await SettlementModel.findByYearMonthTrainer(year, month, row.trainerId);
    if (existing && existing.status !== 'OPEN') continue; // решение уже принято раньше

    if (row.balance === 0) {
      await SettlementModel.upsert(year, month, row.trainerId, { balance: 0, status: 'CLOSED' });
    } else if (row.balance > 0) {
      await SettlementModel.upsert(year, month, row.trainerId, {
        balance: row.balance,
        status: 'CARRIED_OVER',
        carriedToYear: carryYear,
        carriedToMonth: carryMonth,
      });
    } else {
      await SettlementModel.upsert(year, month, row.trainerId, { balance: row.balance, status: 'OPEN' });
      pendingDecisions.push({ trainerId: row.trainerId, trainerName: row.trainerName, balance: row.balance });
    }
  }

  return { year, month, pendingDecisions };
}

// Эти два решения по доплате доступны только для месяца, который уже
// закрыт через closeMonth (кнопки в боте ссылаются именно на такую запись,
// у которой balance уже посчитан) — поэтому здесь запись обязана
// существовать, а не создаваться с нуля.
async function requireExisting(year, month, trainerId) {
  const existing = await SettlementModel.findByYearMonthTrainer(year, month, trainerId);
  if (!existing) {
    throw new Error(`Settlement за ${month}.${year} для специалиста ${trainerId} не найден — месяц ещё не закрыт`);
  }
  return existing;
}

async function markPaidSeparately(year, month, trainerId, paidAmount) {
  await requireExisting(year, month, trainerId);
  return SettlementModel.update(year, month, trainerId, {
    status: 'PAID_SEPARATELY',
    paidAmount,
    paidAt: new Date(),
  });
}

async function markCarriedOver(year, month, trainerId) {
  await requireExisting(year, month, trainerId);
  const { year: carryYear, month: carryMonth } = nextMonthOf(year, month);
  return SettlementModel.update(year, month, trainerId, {
    status: 'CARRIED_OVER',
    carriedToYear: carryYear,
    carriedToMonth: carryMonth,
  });
}

module.exports = { closeMonth, markPaidSeparately, markCarriedOver };
