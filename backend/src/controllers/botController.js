const { Markup } = require('telegraf');
const config = require('../config/default');
const UserModel = require('../models/User');
const SessionModel = require('../models/Session');
const { todayDateOnly, formatDateRu, nowYearMonth } = require('../utils/date');
const { formatMoneySigned } = require('../utils/money');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');
const { resolveAccess } = require('../utils/access');

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
    const { status } = await resolveAccess(ctx.from);

    if (status === 'pending') {
      return ctx.reply(
        'Ваш запрос на доступ отправлен администратору. ' +
          'Как только он его рассмотрит, вы получите уведомление здесь же.',
      );
    }
    if (status === 'rejected') {
      return ctx.reply('Доступ к этому боту отклонён администратором.');
    }

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
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return;

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
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return;

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
  // пользователя — нужна только чтобы узнать свой ID (для владельца — чтобы
  // вписать его в OWNER_TELEGRAM_ID, для остальных — если понадобится
  // добавить в ALLOWED_TELEGRAM_IDS в обход очереди запроса).
  bot.command('myid', (ctx) => {
    ctx.reply(`Ваш Telegram ID: ${ctx.from.id}`);
  });

  // Кнопки «Разрешить» / «Отклонить» из карточки запроса на доступ,
  // которую видит только владелец (OWNER_TELEGRAM_ID).
  bot.action(/^access_(approve|reject):(\d+)$/, async (ctx) => {
    if (!config.ownerTelegramId || String(ctx.from.id) !== String(config.ownerTelegramId)) {
      return ctx.answerCbQuery('Недостаточно прав', { show_alert: true });
    }

    const [, action, telegramIdStr] = ctx.match;
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    try {
      await UserModel.setAccessStatus(telegramIdStr, newStatus);
    } catch (err) {
      return ctx.answerCbQuery('Пользователь не найден', { show_alert: true });
    }

    await ctx.answerCbQuery(action === 'approve' ? 'Доступ разрешён' : 'Доступ отклонён');

    const decisionLabel = action === 'approve' ? '✅ Разрешено' : '❌ Отклонено';
    const originalText = ctx.callbackQuery.message?.text || '';
    try {
      await ctx.editMessageText(`${originalText}\n\n${decisionLabel}`);
    } catch (err) {
      console.error('Не удалось обновить карточку запроса на доступ:', err.message);
    }

    const notifyText =
      action === 'approve'
        ? 'Ваш доступ одобрен! Нажмите /start, чтобы открыть журнал занятий.'
        : 'Ваш запрос на доступ отклонён.';
    try {
      await ctx.telegram.sendMessage(Number(telegramIdStr), notifyText);
    } catch (err) {
      console.error('Не удалось уведомить пользователя о решении по доступу:', err.message);
    }
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
