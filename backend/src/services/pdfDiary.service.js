'use strict';

const SessionNoteModel = require('../models/SessionNote');
const prisma = require('../database/connection');
const { t, formatDateFor } = require('../i18n/report');
const { formatDateShort } = require('../utils/date');
const { createPdfDoc, text, ensureSpace, MARGIN } = require('./pdfBase');

// Дневник занятий за период в PDF (ТЗ v2, §2.15). В отличие от акта сверки
// (§2.11) заметки — не денежные данные, поэтому доступны любому члену
// семьи; структура проще — нет таблиц, только лента по датам.
async function buildDiaryPdf(fromDate, toDate, lang, childName) {
  const L = t(lang);
  const notes = await SessionNoteModel.listForPeriod(fromDate, toDate);

  const authorIds = [...new Set(notes.map((n) => n.authorUserId))];
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } } })
    : [];
  const authorName = new Map(authors.map((u) => [u.id, u.firstName || 'Участник']));

  const { doc, done, pageWidth } = createPdfDoc();
  let y = MARGIN;

  text(doc, L.diaryTitle, MARGIN, y, { size: 18, bold: true });
  y += 26;
  text(
    doc,
    `${formatDateFor(lang, fromDate)} – ${formatDateFor(lang, toDate)}`,
    MARGIN,
    y,
    { size: 12, bold: true },
  );
  y += 18;
  text(doc, `${L.generatedAt}: ${formatDateFor(lang, new Date())}`, MARGIN, y, { size: 9, color: '#6B7280' });
  y += 14;
  if (childName) {
    text(doc, `${L.child}: ${childName}`, MARGIN, y, { size: 9, color: '#6B7280' });
    y += 14;
  }
  y += 16;

  if (notes.length === 0) {
    text(doc, '—', MARGIN, y, { size: 10, color: '#6B7280' });
    doc.end();
    return done;
  }

  for (const note of notes) {
    y = ensureSpace(doc, y, 50);

    const trainer = note.session.actualTrainer || note.session.plannedTrainer;
    const dateLabel = formatDateShort(note.session.date);
    const meta = [dateLabel, trainer?.name, authorName.get(note.authorUserId)].filter(Boolean).join(' · ');
    text(doc, meta, MARGIN, y, { size: 9, bold: true, width: pageWidth });
    y += 14;

    text(doc, note.text, MARGIN, y, { size: 10, width: pageWidth });
    y += doc.heightOfString(note.text, { width: pageWidth }) + 14;
  }

  doc.end();
  return done;
}

module.exports = { buildDiaryPdf };
