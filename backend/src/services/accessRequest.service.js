const { Markup } = require('telegraf');
const bot = require('../core/bot');
const config = require('../config/default');

// Sends the owner a card with the requester's details and Approve/Reject
// buttons. Called once, the first time an unrecognized Telegram user is
// seen (from the bot or from the Mini App auth middleware).
async function notifyOwnerOfRequest(user) {
  if (!config.ownerTelegramId) {
    console.error(
      'OWNER_TELEGRAM_ID не задан — некому отправить запрос на доступ. ' +
        `Пользователь ${user.telegramId} остаётся в статусе PENDING, пока запрос не будет одобрен вручную.`,
    );
    return;
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Без имени';
  const usernamePart = user.username ? ` (@${user.username})` : '';
  const text =
    'Новый запрос на доступ к боту:\n\n' +
    `${name}${usernamePart}\n` +
    `Telegram ID: ${user.telegramId}`;

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback('✅ Разрешить', `access_approve:${user.telegramId}`),
    Markup.button.callback('❌ Отклонить', `access_reject:${user.telegramId}`),
  ]);

  try {
    await bot.telegram.sendMessage(Number(config.ownerTelegramId), text, keyboard);
  } catch (err) {
    console.error('Не удалось отправить владельцу запрос на доступ:', err.message);
  }
}

module.exports = { notifyOwnerOfRequest };
