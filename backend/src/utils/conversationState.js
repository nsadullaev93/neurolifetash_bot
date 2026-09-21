// Лёгкое состояние диалога в памяти процесса — для коротких пошаговых
// сценариев бота (ввод цифр центра §2.12, позже — дневник занятий §2.15 и
// т.п.), где нужен свободный текстовый ответ, а не только кнопки.
//
// Осознанное упрощение: хранится в памяти, не в БД. Переживает обычную
// работу процесса, но сбрасывается при передеплое на Render (редкое
// событие) — в худшем случае прерванный диалог придётся начать заново.
// Для одной семьи с редкими такими сценариями это приемлемо; переносить в
// БД имеет смысл, только если сценариев станет много и они станут длинными.

const state = new Map();
const TTL_MS = 15 * 60 * 1000; // 15 минут — чтобы забытый диалог не завис навсегда

function set(telegramId, data) {
  state.set(String(telegramId), { ...data, expiresAt: Date.now() + TTL_MS });
}

function get(telegramId) {
  const entry = state.get(String(telegramId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    state.delete(String(telegramId));
    return null;
  }
  return entry;
}

function clear(telegramId) {
  state.delete(String(telegramId));
}

module.exports = { set, get, clear };
