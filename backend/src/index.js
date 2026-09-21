const express = require('express');
const cors = require('cors');
const config = require('./config/default');
const bot = require('./core/bot');
const { setupBot } = require('./controllers/botController');
const { startReminderJobs } = require('./jobs/reminders.job');
const { generateMonth } = require('./services/monthGenerator.service');
const { nowYearMonth } = require('./utils/date');

const clientRoutes = require('./routes/client.routes');
const adminRoutes = require('./routes/admin.routes');
const botRoutes = require('./routes/bot.routes');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

// Last-resort safety net: log and keep running instead of crashing the
// whole backend (and with it the bot and reminder jobs) on a stray error.
process.on('unhandledRejection', (err) => {
  console.error('Необработанная ошибка (unhandledRejection):', err);
});
process.on('uncaughtException', (err) => {
  console.error('Необработанная ошибка (uncaughtException):', err);
});

// ALLOW_DEV_LOGIN bypasses Telegram auth entirely — fine for local
// development, but in production it would let anyone reach the family's
// data with no authentication at all. Refuse to start rather than run
// insecurely if this is ever misconfigured on a production deploy.
if (config.allowDevLogin && process.env.NODE_ENV === 'production') {
  console.error(
    'ОШИБКА КОНФИГУРАЦИИ: ALLOW_DEV_LOGIN=true недопустим в продакшене (NODE_ENV=production). ' +
      'Это отключает проверку авторизации Telegram для всех клиентских маршрутов. ' +
      'Установите ALLOW_DEV_LOGIN=false в переменных окружения и перезапустите сервис.',
  );
  process.exit(1);
}

const app = express();

// Render (and most hosts) put the app behind a reverse proxy — trust its
// X-Forwarded-For so req.ip (used by the login rate limiter) reflects the
// real client instead of the proxy's own address.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// More specific prefixes must be registered before the broader '/api' mount —
// otherwise Express routes any '/api/admin/*' request into clientRoutes first
// (which requires Telegram auth) and adminRoutes never gets a chance to run.
app.use('/api/admin', adminRoutes);
app.use('/api/bot', botRoutes);
app.use('/api', clientRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function start() {
  setupBot(bot);

  try {
    const { year, month } = nowYearMonth();
    const result = await generateMonth(year, month);
    console.log(`Занятия на текущий месяц: создано ${result.created}, уже было ${result.skipped}`);
  } catch (err) {
    console.error('Не удалось сгенерировать занятия на текущий месяц:', err.message);
  }

  startReminderJobs(bot);

  app.listen(config.port, () => {
    console.log(`Backend запущен: http://localhost:${config.port}`);
  });

  startBotWithRetry();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// bot.launch() only resolves once polling stops — including when it dies
// because of a transient 409 (two instances briefly overlapping during a
// Render rolling deploy). Previously this was fire-and-forget (no await),
// so that failure vanished into an unhandled rejection and polling never
// resumed: the bot looked "launched" in the logs but silently stopped
// receiving any Telegram updates until the next deploy. Now it retries.
async function startBotWithRetry(attempt = 1) {
  try {
    console.log(`Запуск Telegram-бота (long polling), попытка ${attempt}...`);
    await bot.launch({ dropPendingUpdates: true });
    console.log('Бот остановлен штатно (bot.stop) — не перезапускаем.');
  } catch (err) {
    console.error(`Бот упал (попытка ${attempt}): ${err.message}. Перезапуск через 5 секунд...`);
    setTimeout(() => startBotWithRetry(attempt + 1), 5000);
  }
}

start();
