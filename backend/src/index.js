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
//
// Telegraf's polling loop runs detached from the promise bot.launch()
// returns — even with `await bot.launch()`, a failure inside the loop
// (e.g. the 409 conflict below) surfaces ONLY here, never in a try/catch
// around launch() itself. So a getUpdates failure is handled specially:
// it means polling has silently died, and we relaunch the bot from here.
let botRelaunchTimer = null;
function scheduleBotRelaunch(reason) {
  if (botRelaunchTimer) return;
  console.error(`Бот перестал слушать Telegram (${reason}) — перезапуск через 5 секунд...`);
  botRelaunchTimer = setTimeout(() => {
    botRelaunchTimer = null;
    launchBot();
  }, 5000);
}

process.on('unhandledRejection', (err) => {
  console.error('Необработанная ошибка (unhandledRejection):', err);
  if (err && err.on && err.on.method === 'getUpdates') {
    scheduleBotRelaunch(`${err.response?.error_code}: ${err.response?.description}`);
  }
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
// 10mb — с запасом на восстановление из бэкапа (§2.18): у обычного JSON-запроса
// такой объём не нужен, но файл с историей занятий за годы легко выйдет за 100kb по умолчанию.
app.use(express.json({ limit: '10mb' }));

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

  launchBot();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Actual polling failures (409 during a Render rolling deploy, etc.) surface
// via the global unhandledRejection handler above, not here — this catch is
// only a fallback for a synchronous/setup-time failure in launch() itself.
//
// Deliberately NOT passing dropPendingUpdates: true — every deploy causes a
// few seconds of 409 conflict while the old instance finishes shutting down
// (see scheduleBotRelaunch above), and any message a real user sends during
// that window is queued by Telegram, not lost. dropPendingUpdates would
// throw that queued message away on every single relaunch instead of
// processing it once polling resumes, which is exactly what happened here.
async function launchBot() {
  try {
    console.log('Запуск Telegram-бота (long polling)...');
    await bot.launch();
  } catch (err) {
    scheduleBotRelaunch(err.message);
  }
}

start();
