const rateLimit = require('express-rate-limit');

// Admin password is the only thing standing between the internet and the
// family's data — throttle guesses instead of allowing unlimited attempts.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.' },
});

// Восстановление из бэкапа (аудит надёжности, фаза 5) — открывает
// транзакцию до минуты и переписывает данные всей семьи. Обычный админ
// делает это раз в год-два; лимит защищает от того, что утёкший JWT
// (30 дней жизни, см. admin.middleware.js) можно было бы использовать для
// многократного дорогого повторения этой операции.
const restoreRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток восстановления из бэкапа. Попробуйте снова через час.' },
});

module.exports = { loginRateLimiter, restoreRateLimiter };
