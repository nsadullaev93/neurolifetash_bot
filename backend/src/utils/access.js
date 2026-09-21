const config = require('../config/default');
const UserModel = require('../models/User');
const { notifyOwnerOfRequest } = require('../services/accessRequest.service');

// Пустой список (ALLOWED_TELEGRAM_IDS не задан) = ограничение выключено —
// поведение как раньше, для обратной совместимости при первом деплое.
// Как только список задан — доступ получают только перечисленные Telegram ID,
// минуя очередь запроса/одобрения (см. resolveAccess).
function isAllowedTelegramId(telegramId) {
  if (!config.allowedTelegramIds.length) return true;
  return config.allowedTelegramIds.includes(String(telegramId));
}

// Резолвит доступ конкретного Telegram-пользователя, создавая/обновляя его
// запись в базе. Если пользователь не входит в ALLOWED_TELEGRAM_IDS и видим
// его впервые — отправляет владельцу (OWNER_TELEGRAM_ID) запрос с кнопками
// «Разрешить» / «Отклонить», а сам пользователь получает статус PENDING.
// Возвращает { status: 'approved' | 'pending' | 'rejected', user }.
async function resolveAccess(from) {
  if (isAllowedTelegramId(from.id)) {
    let user = await UserModel.upsertFromTelegram(from);
    if (user.accessStatus !== 'APPROVED') {
      user = await UserModel.setAccessStatus(from.id, 'APPROVED');
    }
    return { status: 'approved', user };
  }

  const existing = await UserModel.findByTelegramId(from.id);
  const user = await UserModel.upsertFromTelegram(from);

  if (user.accessStatus === 'APPROVED') return { status: 'approved', user };
  if (user.accessStatus === 'REJECTED') return { status: 'rejected', user };

  // PENDING — notify the owner only the first time we see this person,
  // so repeated /start taps or Mini App loads don't spam the owner.
  if (!existing) {
    await notifyOwnerOfRequest(user);
  }
  return { status: 'pending', user };
}

module.exports = { isAllowedTelegramId, resolveAccess };
