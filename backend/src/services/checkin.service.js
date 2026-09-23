const { Markup } = require('telegraf');
const SessionModel = require('../models/Session');
const SessionCheckinModel = require('../models/SessionCheckin');
const FamilyMemberModel = require('../models/FamilyMember');
const TrainerModel = require('../models/Trainer');
const { nowTz, dateOnly } = require('../utils/date');

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

// Токен ревизии — Session.updatedAt на момент показа кнопок, зашитый в
// callback_data. Если к моменту нажатия он не совпадает с текущим
// updatedAt в БД — значит, кто-то из семьи уже ответил раньше (гонка
// между несколькими копиями сообщения), и нажатие нужно не применять
// молча, а показать, что уже отмечено (см. staleGuard в botController.js).
function rev(session) {
  return session.updatedAt.getTime().toString(36);
}

function questionText(session) {
  const trainer = session.plannedTrainer;
  return `🕓 ${session.startTime}–${session.endTime} · ${trainer.name}\nЗанятие состоялось?`;
}

function questionKeyboard(sessionId, includeBulkButton, revToken) {
  const rows = [
    [Markup.button.callback('✅ Было', `checkin_done:${sessionId}:${revToken}`)],
    [Markup.button.callback('❌ Не было', `checkin_notdone:${sessionId}:${revToken}`)],
    [Markup.button.callback('🔄 Провёл другой специалист', `checkin_other:${sessionId}:${revToken}`)],
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

function reasonKeyboard(sessionId, revToken) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Специалист отсутствовал', `checkin_reason:${sessionId}:trainer_absent:${revToken}`)],
    [Markup.button.callback('Болезнь', `checkin_reason:${sessionId}:sick:${revToken}`)],
    [Markup.button.callback('Праздник', `checkin_reason:${sessionId}:holiday:${revToken}`)],
    [Markup.button.callback('Перенос', `checkin_reason:${sessionId}:reschedule:${revToken}`)],
    [Markup.button.callback('Без причины', `checkin_reason:${sessionId}:none:${revToken}`)],
  ]);
}

async function otherTrainerKeyboard(sessionId, revToken) {
  const trainers = await TrainerModel.listAll({ onlyActive: true });
  return Markup.inlineKeyboard(
    trainers.map((t) => [Markup.button.callback(t.name, `checkin_trainer:${sessionId}:${t.id}:${revToken}`)]),
  );
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

// Кандидаты на отправку: занятия, закончившиеся 5+ минут назад (в пределах
// ТОГО ЖЕ календарного дня, что и "сейчас минус 5 минут" — см. ниже), ещё
// не отмеченные И ещё без отправленного чекина. Вызывается раз в минуту
// (ТЗ v2, §7.1). Диапазон вместо точного совпадения минуты — переживает
// пропущенный тик (см. Session.listDueForCheckin); фильтр по
// existsForSession нужен именно поэтому — иначе занятие, чекин по
// которому уже разослан, но ещё не отвечен, рассылалось бы повторно
// на каждом следующем тике.
//
// Баг, исправленный 23.09.2026: дата и время раньше брались из ДВУХ разных
// "сейчас" (todayDateOnly() — календарный день на момент вызова; currentHM(5)
// — только "ЧЧ:ММ", без даты). Ровно в первые 5 минут после полуночи это
// расходится: currentHM(5) возвращает "23:5X" (время суток вчерашнего дня),
// а todayDateOnly() уже сегодняшний — в паре с диапазоном (endTime <=
// порог) это ловило вообще ВСЕ сегодняшние занятия, ещё не начавшиеся,
// потому что почти любое endTime дня <= "23:5X". Отсюда чекины в 00:00 про
// занятия, которые ещё не проводились. Фикс — брать дату и время из ОДНОГО
// и того же момента ("сейчас минус 5 минут"), а не из двух независимых.
async function sendDueCheckins(bot) {
  const cutoff = nowTz().subtract(5, 'minute');
  const targetDate = dateOnly(cutoff.year(), cutoff.month() + 1, cutoff.date());
  const targetEndTime = cutoff.format('HH:mm');
  const candidates = await SessionModel.listDueForCheckin(targetDate, targetEndTime);
  if (candidates.length === 0) return;

  const alreadySent = await Promise.all(candidates.map((s) => SessionCheckinModel.existsForSession(s.id)));
  const sessions = candidates.filter((_, i) => !alreadySent[i]);
  if (sessions.length === 0) return;

  const members = await FamilyMemberModel.listAll();
  const recipients = members.filter((m) => m.sessionPings);
  if (recipients.length === 0) return;

  let isFirstOfDay = !(await SessionCheckinModel.existsForDate(targetDate));

  for (const session of sessions) {
    const text = questionText(session);
    const keyboard = questionKeyboard(session.id, isFirstOfDay, rev(session));

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
  rev,
  questionText,
  questionKeyboard,
  resultText,
  changeKeyboard,
  reasonKeyboard,
  otherTrainerKeyboard,
  updateAllCopies,
  sendDueCheckins,
};
