const crypto = require('crypto');
const config = require('../config/default');
const UserModel = require('../models/User');
const { isAllowedTelegramId } = require('../utils/access');

const DEV_TELEGRAM_ID = 1;

function validateInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

// Verifies Telegram WebApp initData sent in the "X-Telegram-Init-Data" header
// and attaches the corresponding User row to req.user (created on first use).
// For local development without going through Telegram, ALLOW_DEV_LOGIN=true
// lets requests with no init data through as a fixed dev user.
async function authMiddleware(req, res, next) {
  try {
    const initData = req.header('X-Telegram-Init-Data');

    if (!initData) {
      if (config.allowDevLogin) {
        let user = await UserModel.findByTelegramId(DEV_TELEGRAM_ID);
        if (!user) {
          user = await UserModel.upsertFromTelegram({
            id: DEV_TELEGRAM_ID,
            first_name: 'Родитель (тест)',
          });
        }
        req.user = user;
        return next();
      }
      return res.status(401).json({ error: 'Отсутствуют данные авторизации Telegram' });
    }

    const from = validateInitData(initData, config.botToken);
    if (!from) {
      return res.status(401).json({ error: 'Не удалось подтвердить данные Telegram' });
    }

    if (!isAllowedTelegramId(from.id)) {
      return res.status(403).json({ error: 'Доступ к этому приложению ограничен' });
    }

    const user = await UserModel.upsertFromTelegram(from);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
