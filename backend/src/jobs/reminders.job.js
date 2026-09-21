const cron = require('node-cron');
const { Markup } = require('telegraf');
const config = require('../config/default');
const UserModel = require('../models/User');
const SessionModel = require('../models/Session');
const { webAppKeyboard } = require('../controllers/botController');
const { generateMonth } = require('../services/monthGenerator.service');
const { calculateForecast, calculatePaymentStatus } = require('../services/forecast.service');
const { calculateMonthlyReconciliation } = require('../services/reconciliation.service');
const { closeMonth } = require('../services/settlement.service');
const { formatMoney, formatMoneySigned } = require('../utils/money');
const { todayDateOnly, currentHM, nowYearMonth, nowTz, isLastDayOfMonth, monthName } = require('../utils/date');

function startReminderJobs(bot) {
  // Every minute: send the "unmarked sessions today" reminder to any user
  // whose personal reminderTime matches the current time in Tashkent.
  cron.schedule(
    '* * * * *',
    async () => {
      try {
        const hm = currentHM();
        const users = await UserModel.listAll();
        const today = todayDateOnly();
        const unmarkedCount = await SessionModel.countUnmarkedForDate(today);

        if (unmarkedCount === 0) return;

        for (const user of users) {
          if (!user.remindersOn) continue;
          if (user.reminderTime !== hm) continue;

          await bot.telegram.sendMessage(
            Number(user.telegramId),
            `Отметьте занятия за сегодня: ${unmarkedCount} не отмечено.`,
            webAppKeyboard(),
          );
        }
      } catch (err) {
        console.error('Ошибка ежедневного напоминания:', err.message);
      }
    },
    { timezone: config.timezone },
  );

  // 1st day of the month, 09:00 — payment calculator for the new month.
  cron.schedule(
    '0 9 1 * *',
    async () => {
      try {
        const { year, month } = nowYearMonth();
        const forecast = await calculateForecast(year, month);
        const users = await UserModel.listAll();

        const lines = forecast.breakdown.map(
          (b) => `${b.trainerName} (${b.levelName}) — ${b.plan} × ${formatMoney(b.rate)} = ${formatMoney(b.amount)}`,
        );
        const text =
          `Расчёт оплаты на ${monthName(month)} ${year}:\n\n${lines.join('\n')}\n\n` +
          `Итого: ${formatMoney(forecast.total)}\n\n` +
          `Пожалуйста, оплатите до 7 числа.`;

        for (const user of users) {
          if (!user.remindersOn) continue;
          await bot.telegram.sendMessage(Number(user.telegramId), text, webAppKeyboard('Открыть оплаты'));
        }
      } catch (err) {
        console.error('Ошибка месячного напоминания об оплате:', err.message);
      }
    },
    { timezone: config.timezone },
  );

  // С 1 по 7 число в 10:00 — напоминание об оплате (ТЗ v2, §2.10), только
  // если кто-то ещё не оплачен или оплачен частично. После 7 числа
  // напоминания прекращаются сами — cron просто не совпадает по дате.
  cron.schedule(
    '0 10 1-7 * *',
    async () => {
      try {
        const { year, month } = nowYearMonth();
        const paymentStatus = await calculatePaymentStatus(year, month);
        const unpaid = paymentStatus.rows.filter((r) => r.status !== 'PAID');
        if (unpaid.length === 0) return;

        const paid = paymentStatus.rows.filter((r) => r.status === 'PAID');
        const lines = unpaid.map((r) => `• ${r.trainerName} — ${formatMoney(r.remaining)}`);
        let text = `💳 Оплата за ${monthName(month)}\nОсталось оплатить:\n${lines.join('\n')}`;
        if (paid.length) {
          text += `\n\nУже оплачено: ${paid.map((r) => r.trainerName).join(', ')}`;
        }

        const users = await UserModel.listAll();
        for (const user of users) {
          if (!user.remindersOn) continue;
          await bot.telegram.sendMessage(Number(user.telegramId), text, webAppKeyboard('Внести оплату'));
        }
      } catch (err) {
        console.error('Ошибка напоминания об оплате (1-7 число):', err.message);
      }
    },
    { timezone: config.timezone },
  );

  // Last day of the month, 20:00 — final reconciliation summary.
  cron.schedule(
    '0 20 * * *',
    async () => {
      try {
        const n = nowTz();
        if (!isLastDayOfMonth(n.year(), n.month() + 1, n.date())) return;

        const { year, month } = nowYearMonth();
        const report = await calculateMonthlyReconciliation(year, month);
        const { pendingDecisions } = await closeMonth(year, month);
        const users = await UserModel.listAll();

        const lines = report.rows.map((r) => {
          const emoji = r.balance > 0 ? '🟢' : r.balance < 0 ? '🔴' : '⚪';
          return `${emoji} ${r.trainerName} — ${formatMoneySigned(r.balance)}`;
        });
        const totalEmoji = report.total > 0 ? '🟢' : report.total < 0 ? '🔴' : '⚪';
        const text =
          `Итоговая сверка за ${monthName(month)} ${year}:\n\n${lines.join('\n')}\n\n` +
          `${totalEmoji} Общий итог: ${formatMoneySigned(report.total)}`;

        // Переплата переносится автоматически. Доплата (баланс < 0) ждёт
        // решения — по кнопке под сообщением для каждого такого специалиста.
        // «Внести цифры центра» (§2.12) доступна всегда, независимо от знака баланса.
        const decisionButtons = pendingDecisions.flatMap((d) => [
          [
            Markup.button.callback(
              `${d.trainerName}: оплатил отдельно`,
              `settlement_paid:${d.trainerId}:${year}:${month}`,
            ),
          ],
          [
            Markup.button.callback(
              `${d.trainerName}: добавить к следующей оплате`,
              `settlement_carry:${d.trainerId}:${year}:${month}`,
            ),
          ],
        ]);
        decisionButtons.push([Markup.button.callback('Внести цифры центра', `centerfigures_start:${year}:${month}`)]);
        const decisionKeyboard = Markup.inlineKeyboard(decisionButtons);

        for (const user of users) {
          if (!user.remindersOn) continue;
          await bot.telegram.sendMessage(Number(user.telegramId), text, decisionKeyboard);
        }
      } catch (err) {
        console.error('Ошибка итоговой сверки месяца:', err.message);
      }
    },
    { timezone: config.timezone },
  );

  // Daily at 00:05 — make sure the current month's sessions exist
  // (idempotent, safe to run repeatedly; also covers schedule template changes).
  cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        const { year, month } = nowYearMonth();
        await generateMonth(year, month);
      } catch (err) {
        console.error('Ошибка автогенерации месяца:', err.message);
      }
    },
    { timezone: config.timezone },
  );

  // Каждые 10 минут — self-ping собственного публичного URL, чтобы Render
  // (бесплатный тариф) не усыплял сервис после 15 минут без входящих запросов.
  // Интервал (не привязан к таймзоне) — сработает даже если RENDER_EXTERNAL_URL
  // недоступен локально: тогда задача просто не регистрируется.
  if (config.externalUrl && config.selfPingEnabled) {
    cron.schedule('*/10 * * * *', async () => {
      try {
        const res = await fetch(`${config.externalUrl}/api/health`);
        if (!res.ok) {
          console.error(`Self-ping: сервер ответил статусом ${res.status}`);
        }
      } catch (err) {
        console.error('Self-ping не удался:', err.message);
      }
    });
    console.log(`Self-ping включён: каждые 10 минут → ${config.externalUrl}/api/health`);
  } else {
    console.log('Self-ping отключён (нет RENDER_EXTERNAL_URL/SELF_URL или SELF_PING_ENABLED=false)');
  }
}

module.exports = { startReminderJobs };
