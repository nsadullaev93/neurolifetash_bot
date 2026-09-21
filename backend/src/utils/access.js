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

  let user = await UserModel.upsertFromTelegram(from);

  if (user.accessStatus === 'APPROVED') return { status: 'approved', user };
  if (user.accessStatus === 'REJECTED') return { status: 'rejected', user };

  // PENDING — notify the owner once per pending "episode", tracked via
  // accessRequestNotifiedAt rather than "is this a brand-new row": a user
  // whose status was manually (or otherwise) reset back to PENDING must
  // also get a fresh notification, not just users seen for the first time.
  if (!user.accessRequestNotifiedAt) {
    await notifyOwnerOfRequest(user);
    user = await UserModel.markAccessRequestNotified(from.id);
  }
  return { status: 'pending', user };
}

module.exports = { isAllowedTelegramId, resolveAccess };
