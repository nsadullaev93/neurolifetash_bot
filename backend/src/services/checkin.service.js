const { Markup } = require('telegraf');
const SessionModel = require('../models/Session');
const SessionCheckinModel = require('../models/SessionCheckin');
const FamilyMemberModel = require('../models/FamilyMember');
const TrainerModel = require('../models/Trainer');
const { todayDateOnly, currentHM } = require('../utils/date');

// «Без причины» и другие быстрые причины из кнопок чат-чекина (ТЗ v2,
// §7.1) — упрощённый набор по сравнению с полным списком статусов в
// Admin Panel/Mini App, ровно как описано в ТЗ.
const REASON_STATUS = {
  trainer_absent: 'TRAINER_ABSENT',
  sick: 'CHILD_SICK_NO_CERT',
  holiday: 'CLOSED_DAY',
  reschedule: 'RESCHEDULED',
  none: 'CHILD_ABSENT',
};

function questionText(session) {
  const trainer = session.plannedTrainer;
  return `🕓 ${session.startTime}–${session.endTime} · ${trainer.name}\nЗанятие состоялось?`;
}

function questionKeyboard(sessionId, includeBulkButton) {
  const rows = [
    [Markup.button.callback('✅ Было', `checkin_done:${sessionId}`)],
    [Markup.button.callback('❌ Не было', `checkin_notdone:${sessionId}`)],
    [Markup.button.callback('🔄 Провёл другой специалист', `checkin_other:${sessionId}`)],
  ];
  if (includeBulkButton) {
    rows.push([Markup.button.callback('🏠 Сегодня не идём', 'checkin_bulk_absent')]);
  }
  return Markup.inlineKeyboard(rows);
}

function resultText(session, actorName) {
  const trainer = session.actualTrainer || session.plannedTrainer;
  const who = actorName ? ` · отметил(а) ${actorName}` : '';
  if (session.status === 'COMPLETED' || session.status === 'MAKEUP') {
    return `✅ ${trainer.name}, ${session.startTime} — было${who}`;
  }
  const reasonLabels = {
    TRAINER_ABSENT: 'специалист отсутствовал',
    CHILD_SICK_NO_CERT: 'болезнь',
    CHILD_SICK_CERT: 'болезнь',
    CLOSED_DAY: 'праздник',
    RESCHEDULED: 'перенос',
    CHILD_ABSENT: 'без причины',
  };
  const reason = reasonLabels[session.status];
  const reasonPart = reason ? ` (${reason})` : '';
  return `❌ ${trainer.name}, ${session.startTime} — не было${reasonPart}${who}`;
}

function changeKeyboard(sessionId) {
  return Markup.inlineKeyboard([[Markup.button.callback('Изменить', `checkin_change:${sessionId}`)]]);
}

function reasonKeyboard(sessionId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Специалист отсутствовал', `checkin_reason:${sessionId}:trainer_absent`)],
    [Markup.button.callback('Болезнь', `checkin_reason:${sessionId}:sick`)],
    [Markup.button.callback('Праздник', `checkin_reason:${sessionId}:holiday`)],
    [Markup.button.callback('Перенос', `checkin_reason:${sessionId}:reschedule`)],
    [Markup.button.callback('Без причины', `checkin_reason:${sessionId}:none`)],
  ]);
}

async function otherTrainerKeyboard(sessionId) {
  const trainers = await TrainerModel.listAll({ onlyActive: true });
  return Markup.inlineKeyboard(trainers.map((t) => [Markup.button.callback(t.name, `checkin_trainer:${sessionId}:${t.id}`)]));
}

// Редактирует ВСЕ разосланные копии сообщения по этому занятию (у каждого
// получателя своя) — ошибка на одной копии (удалили чат, заблокировали
// бота) не должна прерывать остальные.
async function updateAllCopies(bot, sessionId, text, keyboard) {
  const checkins = await SessionCheckinModel.listForSession(sessionId);
  for (const c of checkins) {
    try {
      await bot.telegram.editMessageText(Number(c.chatId), c.messageId, undefined, text, keyboard);
    } catch (err) {
      console.error(`Не удалось обновить чекин-сообщение (session ${sessionId}, chat ${c.chatId}):`, err.message);
    }
  }
}

// Кандидаты на отправку: занятия сегодня, заканчивающиеся 5 минут назад,
// ещё не отмеченные. Вызывается раз в минуту (ТЗ v2, §7.1).
async function sendDueCheckins(bot) {
  const targetEndTime = currentHM(5); // "сейчас минус 5 минут"
  const today = todayDateOnly();
  const sessions = await SessionModel.listDueForCheckin(today, targetEndTime);
  if (sessions.length === 0) return;

  const members = await FamilyMemberModel.listAll();
  const recipients = members.filter((m) => m.sessionPings);
  if (recipients.length === 0) return;

  let isFirstOfDay = !(await SessionCheckinModel.existsForDate(today));

  for (const session of sessions) {
    const text = questionText(session);
    const keyboard = questionKeyboard(session.id, isFirstOfDay);

    for (const member of recipients) {
      try {
        const sent = await bot.telegram.sendMessage(Number(member.user.telegramId), text, keyboard);
        await SessionCheckinModel.create(session.id, member.userId, member.user.telegramId, sent.message_id);
      } catch (err) {
        console.error(`Не удалось отправить чекин (session ${session.id}, user ${member.userId}):`, err.message);
      }
    }
    isFirstOfDay = false; // кнопка «Сегодня не идём» — только на самом первом сообщении дня
  }
}

module.exports = {
  REASON_STATUS,
  questionText,
  questionKeyboard,
  resultText,
  changeKeyboard,
  reasonKeyboard,
  otherTrainerKeyboard,
  updateAllCopies,
  sendDueCheckins,
};
