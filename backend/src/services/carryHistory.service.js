const SettlementModel = require('../models/Settlement');

// Строки для «Истории оплат»: переплата прошлого месяца, зачтённая
// специалисту в следующем месяце, — оплата «из остатка», без новых денег.
// Это НЕ MonthlyPayment (иначе остаток посчитался бы дважды — в сверке и в
// «к оплате»), только отображение. Несколько остатков на одного получателя
// в одном месяце (Ван, 10.2026: Усмон + Ли) сливаются в одну строку.
// Доплаты (balance < 0) сюда не попадают — это долг, а не оплата.
async function listCarryHistoryEntries() {
  const carries = await SettlementModel.listCarriedOver();
  const byKey = new Map();
  for (const s of carries) {
    if (s.balance <= 0 || !s.carriedToYear || !s.carriedToMonth) continue;
    const target = s.carriedToTrainer || s.trainer;
    const key = `${s.carriedToYear}-${s.carriedToMonth}-${target.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `carry-${key}`,
        year: s.carriedToYear,
        month: s.carriedToMonth,
        trainerId: target.id,
        trainerName: target.name,
        paidSessions: null,
        totalAmount: 0,
        fromCarry: true,
        sources: [],
      });
    }
    const entry = byKey.get(key);
    entry.totalAmount += s.balance;
    entry.sources.push({ trainerName: s.trainer.name, year: s.year, month: s.month, amount: s.balance });
  }
  return Array.from(byKey.values());
}

module.exports = { listCarryHistoryEntries };
