const config = require('../config/default');

// Пустой список (ALLOWED_TELEGRAM_IDS не задан) = ограничение выключено —
// поведение как раньше, для обратной совместимости при первом деплое.
// Как только список задан — доступ получают только перечисленные Telegram ID.
function isAllowedTelegramId(telegramId) {
  if (!config.allowedTelegramIds.length) return true;
  return config.allowedTelegramIds.includes(String(telegramId));
}

module.exports = { isAllowedTelegramId };
