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

module.exports = { loginRateLimiter };
