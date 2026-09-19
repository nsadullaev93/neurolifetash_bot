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

const app = express();

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

  bot.launch();
  console.log('Telegram-бот запущен (long polling)');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

start();
