const { Markup } = require('telegraf');
const config = require('../config/default');
const UserModel = require('../models/User');
const SessionModel = require('../models/Session');
const { todayDateOnly, formatDateRu, nowYearMonth, monthName } = require('../utils/date');
const { formatMoney, formatMoneySigned } = require('../utils/money');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');
const { markPaidSeparately, markCarriedOver } = require('../services/settlement.service');
const SettlementModel = require('../models/Settlement');
const HolidayModel = require('../models/Holiday');
const ClosedDayModel = require('../models/ClosedDay');
const { resolveAccess, isAllowedTelegramId } = require('../utils/access');
const conversationState = require('../utils/conversationState');

function isOwner(telegramId) {
  return !!config.ownerTelegramId && String(telegramId) === String(config.ownerTelegramId);
}

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
    if (!isOwner(ctx.from.id)) {
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

  // Список всех, у кого есть (или был) доступ, с кнопками отзыва — только
  // для владельца (OWNER_TELEGRAM_ID).
  bot.command('users', async (ctx) => {
    if (!isOwner(ctx.from.id)) return;

    const users = await UserModel.listAll();
    const label = (u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Без имени';
      const usernamePart = u.username ? ` (@${u.username})` : '';
      return `${name}${usernamePart} — ${u.telegramId}`;
    };

    const trusted = users.filter((u) => isAllowedTelegramId(u.telegramId));
    const approved = users.filter((u) => !isAllowedTelegramId(u.telegramId) && u.accessStatus === 'APPROVED');
    const pending = users.filter((u) => !isAllowedTelegramId(u.telegramId) && u.accessStatus === 'PENDING');
    const rejected = users.filter((u) => !isAllowedTelegramId(u.telegramId) && u.accessStatus === 'REJECTED');

    const sections = [];
    if (trusted.length) {
      sections.push(
        '🔒 Доверенный список (ALLOWED_TELEGRAM_IDS — отзывается только правкой этой переменной в Render, не кнопкой):\n' +
          trusted.map(label).join('\n'),
      );
    }
    if (approved.length) {
      sections.push('✅ Одобрены через бота (можно отозвать кнопкой ниже):\n' + approved.map(label).join('\n'));
    }
    if (pending.length) {
      sections.push('⏳ Ожидают решения:\n' + pending.map(label).join('\n'));
    }
    if (rejected.length) {
      sections.push('❌ Отклонены:\n' + rejected.map(label).join('\n'));
    }

    await ctx.reply(sections.length ? sections.join('\n\n') : 'Пользователей пока нет.');

    if (approved.length) {
      const keyboard = Markup.inlineKeyboard(
        approved.map((u) => [
          Markup.button.callback(
            `❌ Отозвать: ${u.firstName || u.telegramId}`,
            `access_revoke:${u.telegramId}`,
          ),
        ]),
      );
      await ctx.reply('Отозвать доступ:', keyboard);
    }

    if (pending.length) {
      // Reuses the same access_approve / access_reject handler as the
      // original request card — lets you resolve someone even if that
      // original message scrolled away or (for anyone reset to PENDING
      // manually) was never sent in the first place.
      const keyboard = Markup.inlineKeyboard(
        pending.map((u) => [
          Markup.button.callback(`✅ ${u.firstName || u.telegramId}`, `access_approve:${u.telegramId}`),
          Markup.button.callback(`❌ ${u.firstName || u.telegramId}`, `access_reject:${u.telegramId}`),
        ]),
      );
      await ctx.reply('Решить по ожидающим:', keyboard);
    }
  });

  // Кнопка «Отозвать доступ» из /users — тоже только для владельца. Ставит
  // REJECTED (это же снимает accessRequestNotifiedAt, см. setAccessStatus —
  // если человек когда-нибудь попросит доступ снова, уведомление придёт заново).
  bot.action(/^access_revoke:(\d+)$/, async (ctx) => {
    if (!isOwner(ctx.from.id)) {
      return ctx.answerCbQuery('Недостаточно прав', { show_alert: true });
    }

    const [, telegramIdStr] = ctx.match;

    if (isAllowedTelegramId(telegramIdStr)) {
      return ctx.answerCbQuery(
        'Этот ID в доверенном списке ALLOWED_TELEGRAM_IDS — уберите его оттуда в Render, кнопка тут бессильна.',
        { show_alert: true },
      );
    }

    try {
      await UserModel.setAccessStatus(telegramIdStr, 'REJECTED');
    } catch (err) {
      return ctx.answerCbQuery('Пользователь не найден', { show_alert: true });
    }

    await ctx.answerCbQuery('Доступ отозван');

    try {
      await ctx.telegram.sendMessage(Number(telegramIdStr), 'Ваш доступ к боту был отозван администратором.');
    } catch (err) {
      console.error('Не удалось уведомить пользователя об отзыве доступа:', err.message);
    }
  });

  // Кнопки закрытия месяца при доплате (ТЗ v2, §2.9) — из итогового
  // сообщения последнего дня месяца. Доступны любому, кто прошёл
  // resolveAccess (полноценные права участников семьи — отдельная фаза).
  bot.action(/^settlement_paid:(\d+):(\d+):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();

    const [, trainerIdStr, yearStr, monthStr] = ctx.match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const trainerId = Number(trainerIdStr);

    const report = await calculateMonthlyReconciliation(year, month);
    const row = report.rows.find((r) => r.trainerId === trainerId);
    const paidAmount = row ? Math.abs(row.balance) : 0;

    await markPaidSeparately(year, month, trainerId, paidAmount);
    await ctx.answerCbQuery('Отмечено: оплачено отдельно');

    const originalText = ctx.callbackQuery.message?.text || '';
    try {
      await ctx.editMessageText(
        `${originalText}\n\n✅ ${row ? row.trainerName : trainerId}: доплата ${formatMoney(paidAmount)} оплачена отдельно`,
      );
    } catch (err) {
      console.error('Не удалось обновить сообщение о закрытии месяца:', err.message);
    }
  });

  bot.action(/^settlement_carry:(\d+):(\d+):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();

    const [, trainerIdStr, yearStr, monthStr] = ctx.match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const trainerId = Number(trainerIdStr);

    const updated = await markCarriedOver(year, month, trainerId);
    await ctx.answerCbQuery('Отмечено: добавлено к следующей оплате');

    const trainerName = updated.trainer?.name || trainerId;
    const originalText = ctx.callbackQuery.message?.text || '';
    try {
      await ctx.editMessageText(`${originalText}\n\n➡️ ${trainerName}: доплата добавлена к следующей оплате`);
    } catch (err) {
      console.error('Не удалось обновить сообщение о закрытии месяца:', err.message);
    }
  });

  // Сверка с цифрами центра (ТЗ v2, §2.12). Запускается кнопкой
  // «Внести цифры центра» из итогового сообщения месяца (добавляется
  // ниже, к decisionKeyboard в reminders.job.js). Бот по очереди спрашивает
  // число по каждому специалисту, затем показывает сравнение с кнопками
  // «Принять цифру центра» / «Оставить свою» там, где цифры разошлись.
  async function askCenterFigure(ctx, state) {
    const trainer = state.trainers[state.index];
    const guesses = [...new Set([trainer.completed - 2, trainer.completed - 1, trainer.completed, trainer.completed + 1, trainer.completed + 2])]
      .filter((v) => v >= 0);
    const keyboard = Markup.inlineKeyboard([
      guesses.map((v) => Markup.button.callback(String(v), `centerfig_guess:${v}`)),
      [Markup.button.callback('Другое', 'centerfig_other')],
    ]);
    await ctx.reply(
      `Сколько занятий провёл(а) ${trainer.trainerName} по данным центра? (у нас отмечено: ${trainer.completed})`,
      keyboard,
    );
  }

  async function finishCenterFigures(ctx, state) {
    for (const [trainerId, centerConducted] of Object.entries(state.answers)) {
      await SettlementModel.update(state.year, state.month, Number(trainerId), { centerConducted });
    }
    conversationState.clear(ctx.from.id);

    const report = await calculateMonthlyReconciliation(state.year, state.month);
    const relevant = report.rows.filter((r) => state.answers[r.trainerId] !== undefined);

    const lines = relevant.map((r) =>
      r.mismatch ? `⚠️ ${r.trainerName}: у нас ${r.completed}, у центра ${r.centerConducted}` : `✅ ${r.trainerName}: ${r.completed} = ${r.centerConducted}`,
    );
    await ctx.reply(`📋 Сверка с центром · ${monthName(state.month)} ${state.year}\n\n${lines.join('\n')}`);

    for (const r of relevant.filter((r) => r.mismatch)) {
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Показать мои даты', `centerfig_dates:${r.trainerId}:${state.year}:${state.month}`)],
        [
          Markup.button.callback('Принять цифру центра', `centerfig_accept:${r.trainerId}:${state.year}:${state.month}`),
          Markup.button.callback('Оставить свою', `centerfig_keep:${r.trainerId}:${state.year}:${state.month}`),
        ],
      ]);
      await ctx.reply(`${r.trainerName}: у нас ${r.completed}, у центра ${r.centerConducted}`, keyboard);
    }
  }

  bot.action(/^centerfigures_start:(\d+):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();

    const [, yearStr, monthStr] = ctx.match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const report = await calculateMonthlyReconciliation(year, month);
    if (report.rows.length === 0) {
      return ctx.answerCbQuery('Нет данных за этот месяц', { show_alert: true });
    }

    await ctx.answerCbQuery();
    conversationState.set(ctx.from.id, {
      type: 'center_figures',
      year,
      month,
      trainers: report.rows.map((r) => ({ trainerId: r.trainerId, trainerName: r.trainerName, completed: r.completed })),
      index: 0,
      answers: {},
    });
    await askCenterFigure(ctx, conversationState.get(ctx.from.id));
  });

  bot.action(/^centerfig_guess:(-?\d+)$/, async (ctx) => {
    const state = conversationState.get(ctx.from.id);
    if (!state || state.type !== 'center_figures') return ctx.answerCbQuery();

    await ctx.answerCbQuery();
    const value = Number(ctx.match[1]);
    const trainer = state.trainers[state.index];
    state.answers[trainer.trainerId] = value;
    state.index++;

    if (state.index >= state.trainers.length) {
      await finishCenterFigures(ctx, state);
    } else {
      conversationState.set(ctx.from.id, state);
      await askCenterFigure(ctx, state);
    }
  });

  bot.action('centerfig_other', async (ctx) => {
    const state = conversationState.get(ctx.from.id);
    if (!state || state.type !== 'center_figures') return ctx.answerCbQuery();

    await ctx.answerCbQuery();
    state.awaitingText = true;
    conversationState.set(ctx.from.id, state);
    await ctx.reply('Введите число текстом.');
  });

  // Свободный текстовый ответ — только для «Другое» из сверки с центром.
  // Регистрируется после всех bot.command(...), поэтому обычные команды
  // сюда не попадают (Telegraf сам их перехватывает раньше).
  bot.on('text', async (ctx, next) => {
    const state = conversationState.get(ctx.from.id);
    if (!state || state.type !== 'center_figures' || !state.awaitingText) return next();

    const value = parseInt(ctx.message.text.trim(), 10);
    if (!Number.isInteger(value) || value < 0) {
      return ctx.reply('Нужно целое число ≥ 0. Попробуйте ещё раз.');
    }

    const trainer = state.trainers[state.index];
    state.answers[trainer.trainerId] = value;
    state.index++;
    state.awaitingText = false;

    if (state.index >= state.trainers.length) {
      await finishCenterFigures(ctx, state);
    } else {
      conversationState.set(ctx.from.id, state);
      await askCenterFigure(ctx, state);
    }
  });

  bot.action(/^centerfig_dates:(\d+):(\d+):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();
    await ctx.answerCbQuery();

    const [, trainerIdStr, yearStr, monthStr] = ctx.match;
    const trainerId = Number(trainerIdStr);
    const year = Number(yearStr);
    const month = Number(monthStr);

    const sessions = await SessionModel.listForMonth(year, month);
    const own = sessions.filter((s) => (s.actualTrainerId || s.plannedTrainerId) === trainerId);
    if (own.length === 0) return ctx.reply('Занятий не найдено.');

    const lines = own.map((s) => {
      const emoji = s.status === 'COMPLETED' || s.status === 'MAKEUP' ? '✅' : s.status === 'PLANNED' ? '⬜' : '❌';
      const dateLabel = formatDateRu(s.date);
      return `${emoji} ${dateLabel} · ${config.statusLabels[s.status]}`;
    });
    await ctx.reply(`Даты по специалисту:\n\n${lines.join('\n')}`);
  });

  bot.action(/^centerfig_(accept|keep):(\d+):(\d+):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();

    const [, decision, trainerIdStr, yearStr, monthStr] = ctx.match;
    const trainerId = Number(trainerIdStr);
    const year = Number(yearStr);
    const month = Number(monthStr);

    const report = await calculateMonthlyReconciliation(year, month);
    const row = report.rows.find((r) => r.trainerId === trainerId);
    if (!row) return ctx.answerCbQuery('Специалист не найден', { show_alert: true });

    const agreedConducted = decision === 'accept' ? row.centerConducted : row.completed;
    await SettlementModel.update(year, month, trainerId, { agreedConducted });

    await ctx.answerCbQuery(decision === 'accept' ? 'Принята цифра центра' : 'Оставлена своя цифра');
    const originalText = ctx.callbackQuery.message?.text || '';
    try {
      await ctx.editMessageText(`${originalText}\n\n${decision === 'accept' ? '✅ принята цифра центра' : '✅ оставлена своя цифра'} (${agreedConducted})`);
    } catch (err) {
      console.error('Не удалось обновить сообщение сверки с центром:', err.message);
    }
  });

  // Ответ на вопрос «Центр работает?» про праздничный день (ТЗ v2, §2.13).
  bot.action(/^holiday_(open|closed|unknown):(\d+)$/, async (ctx) => {
    const { status } = await resolveAccess(ctx.from);
    if (status !== 'approved') return ctx.answerCbQuery();

    const [, decision, idStr] = ctx.match;
    const holiday = await HolidayModel.findById(idStr);
    if (!holiday) return ctx.answerCbQuery('Праздник не найден', { show_alert: true });

    if (decision === 'unknown') {
      await ctx.answerCbQuery('Спросим ещё раз позже');
      return;
    }

    if (decision === 'open') {
      await HolidayModel.setStatus(holiday.id, 'OPEN');
      await ctx.answerCbQuery('Отмечено: центр работает');
    } else {
      await HolidayModel.setStatus(holiday.id, 'CLOSED');
      await ClosedDayModel.createAndCancelSessions(holiday.date, holiday.title);
      await ctx.answerCbQuery('Отмечено: центр закрыт');
    }

    const originalText = ctx.callbackQuery.message?.text || '';
    const decisionLabel = decision === 'open' ? '✅ Центр работает' : '🚫 Центр закрыт';
    try {
      await ctx.editMessageText(`${originalText}\n\n${decisionLabel}`);
    } catch (err) {
      console.error('Не удалось обновить сообщение о праздничном дне:', err.message);
    }
  });

  bot.help((ctx) => {
    const commands =
      '/start — открыть журнал занятий\n' +
      '/today — занятия на сегодня\n' +
      '/balance — баланс по специалистам за текущий месяц\n' +
      '/myid — узнать свой Telegram ID\n' +
      (isOwner(ctx.from.id) ? '/users — список пользователей и отзыв доступа\n' : '') +
      '/help — эта справка';
    return ctx.reply(`Доступные команды:\n\n${commands}`);
  });
}

module.exports = { setupBot, webAppKeyboard };
