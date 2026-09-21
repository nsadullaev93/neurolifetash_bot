const { Markup } = require('telegraf');
const config = require('../config/default');
const UserModel = require('../models/User');
const SessionModel = require('../models/Session');
const { todayDateOnly, formatDateRu, nowYearMonth } = require('../utils/date');
const { formatMoneySigned } = require('../utils/money');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');
const { isAllowedTelegramId } = require('../utils/access');

// Telegram rejects any inline button (web_app or plain url) pointing at
// http://localhost — it requires a real public https:// address. Until
// ngrok is set up (see final setup guide), WEBAPP_URL is still localhost,
// so skip the button entirely rather than let Telegram reject the whole
// message (which would otherwise crash the send).
function isUsableWebAppUrl(url) {
  if (!url.startsWith('https://')) return false;
  try {
    const host = new URL(url).hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

function webAppKeyboard(text = 'Открыть журнал занятий') {
  if (!isUsableWebAppUrl(config.webAppUrl)) return undefined;
  return Markup.inlineKeyboard([Markup.button.webApp(text, config.webAppUrl)]);
}

function setupBot(bot) {
  // Prevents an error in any single handler (e.g. a rejected Telegram API
  // call) from crashing the whole bot/backend process.
  bot.catch((err, ctx) => {
    console.error(`Ошибка бота при обработке ${ctx.updateType}:`, err.message);
  });

  bot.start(async (ctx) => {
    if (!isAllowedTelegramId(ctx.from.id)) {
      return ctx.reply('Этот бот приватный и недоступен для посторонних пользователей.');
    }
    await UserModel.upsertFromTelegram(ctx.from);
    const keyboard = webAppKeyboard();
    const note = keyboard ? '' : '\n\n(Кнопка появится после настройки ngrok — см. инструкцию.)';
    await ctx.reply(
      'Здравствуйте! Это журнал занятий в реабилитационном центре.\n\n' +
        'Здесь вы можете отмечать проведённые занятия, вносить оплаты и следить за балансом по каждому специалисту.' +
        note,
      keyboard,
    );
  });

  bot.command('today', async (ctx) => {
    if (!isAllowedTelegramId(ctx.from.id)) return;
    await UserModel.upsertFromTelegram(ctx.from);
    const today = todayDateOnly();
    const sessions = await SessionModel.listForDate(today);

    if (sessions.length === 0) {
      return ctx.reply(`${formatDateRu(today)}\n\nНа сегодня занятий не запланировано.`);
    }

    const lines = sessions.map((s) => {
      const trainer = s.actualTrainer || s.plannedTrainer;
      const statusLabel = config.statusLabels[s.status];
      const emoji = s.status === 'COMPLETED' || s.status === 'MAKEUP' ? '✅' : s.status === 'PLANNED' ? '⬜' : '❌';
      return `${emoji} ${s.startTime}–${s.endTime} · ${trainer.name} — ${statusLabel}`;
    });

    await ctx.reply(`Занятия на сегодня, ${formatDateRu(today)}:\n\n${lines.join('\n')}`, webAppKeyboard());
  });

  bot.command('balance', async (ctx) => {
    if (!isAllowedTelegramId(ctx.from.id)) return;
    await UserModel.upsertFromTelegram(ctx.from);
    const { year, month } = nowYearMonth();
    const report = await calculateMonthlyReconciliation(year, month);

    const lines = report.rows.map((r) => {
      const emoji = r.balance > 0 ? '🟢' : r.balance < 0 ? '🔴' : '⚪';
      return `${emoji} ${r.trainerName} — проведено ${r.completed} из ${r.paid} оплаченных · ${formatMoneySigned(r.balance)}`;
    });

    const totalEmoji = report.total > 0 ? '🟢' : report.total < 0 ? '🔴' : '⚪';
    const text =
      `Баланс за текущий месяц:\n\n${lines.join('\n')}\n\n` +
      `${totalEmoji} Итого: ${formatMoneySigned(report.total)}`;

    await ctx.reply(text, webAppKeyboard('Открыть отчёт'));
  });

  // Показывает Telegram ID отправителя. Не требует доступа и не создаёт
  // пользователя — нужна только чтобы узнать, какой ID вписать в
  // ALLOWED_TELEGRAM_IDS на Render.
  bot.command('myid', (ctx) => {
    ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
  });

  bot.help((ctx) =>
    ctx.reply(
      'Доступные команды:\n\n' +
        '/start — открыть журнал занятий\n' +
        '/today — занятия на сегодня\n' +
        '/balance — баланс по специалистам за текущий месяц\n' +
        '/myid — узнать свой Telegram ID\n' +
        '/help — эта справка',
    ),
  );
}

module.exports = { setupBot, webAppKeyboard };
