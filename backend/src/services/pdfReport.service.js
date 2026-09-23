'use strict';

const { getMonthlyReport } = require('./report.service');
const SessionModel = require('../models/Session');
const { t, monthYearLabel, formatDateFor } = require('../i18n/report');
const { formatDateShort } = require('../utils/date');
const {
  createPdfDoc,
  text,
  ensureSpace,
  measureHeight,
  formatSum,
  formatSumSigned,
  MARGIN,
  PAGE_BOTTOM,
} = require('./pdfBase');

const CELL_PAD = 8; // отступ сверху+снизу внутри строки таблицы

// Высота строки = высота самой "высокой" (перенёсшейся на несколько строк)
// ячейки + отступ, но не меньше минимума для однострочной строки при данном
// кегле — иначе короткие строки визуально слипаются без воздуха.
function rowHeightFor(doc, cells, widths, fontSize, minH) {
  let max = minH;
  cells.forEach((val, i) => {
    const h = measureHeight(doc, val, widths[i] - 8, fontSize) + CELL_PAD;
    if (h > max) max = h;
  });
  return max;
}

async function buildMonthlyReportPdf(year, month, lang, childName) {
  const L = t(lang);
  const report = await getMonthlyReport(year, month);
  const sessions = await SessionModel.listForMonth(year, month);

  const { doc, done, pageWidth } = createPdfDoc();
  let y = MARGIN;

  // 1. Шапка
  text(doc, L.reportTitle, MARGIN, y, { size: 18, bold: true });
  y += 26;
  text(doc, monthYearLabel(lang, month, year), MARGIN, y, { size: 12, bold: true });
  y += 18;
  text(doc, `${L.generatedAt}: ${formatDateFor(lang, new Date())}`, MARGIN, y, { size: 9, color: '#6B7280' });
  y += 14;
  if (childName) {
    text(doc, `${L.child}: ${childName}`, MARGIN, y, { size: 9, color: '#6B7280' });
    y += 14;
  }
  y += 10;

  // 2. Сводная таблица по специалистам. Ширины колонок подобраны так, чтобы
  // типичные значения (даже на самом длинном из трёх языков) помещались в
  // одну строку без переноса, но точная подгонка под все локали ненадёжна —
  // поэтому высота строки всё равно считается динамически (rowHeightFor),
  // а не фиксирована: если где-то всё же перенесётся на 2 строки, следующая
  // строка таблицы больше не наедет на неё сверху (раньше высота строки
  // была жёстко зашита в 20pt, и любой перенос текста — например,
  // "Начальный" в узкой колонке "Уровень" — наезжал на следующую строку).
  const cols = [
    { key: 'trainer', label: L.trainer, w: 0.14 },
    { key: 'level', label: L.level, w: 0.13 },
    { key: 'rate', label: L.rate, w: 0.13 },
    { key: 'paid', label: L.paid, w: 0.08 },
    { key: 'conducted', label: L.conducted, w: 0.09 },
    { key: 'center', label: L.centerConducted, w: 0.13 },
    { key: 'notConducted', label: L.notConducted, w: 0.09 },
    { key: 'balance', label: L.balance, w: 0.21 },
  ].map((c) => ({ ...c, w: c.w * pageWidth }));
  const colWidths = cols.map((c) => c.w);

  const rowH = 20; // минимальная высота однострочной строки
  // Чистая функция от startY, а не замыкание над внешним y — иначе при
  // переносе на новую страницу (см. ensureSpace(..., drawTableHeader) ниже)
  // шапка нарисовалась бы на позиции СТАРОЙ страницы вместо верха новой.
  const drawTableHeaderAt = (startY) => {
    const labels = cols.map((c) => c.label);
    const headerH = rowHeightFor(doc, labels, colWidths, 7, 24);
    doc.rect(MARGIN, startY, pageWidth, headerH).fill('#F3F4F6');
    let x = MARGIN;
    for (const c of cols) {
      text(doc, c.label, x + 4, startY + 5, { size: 7, bold: true, width: c.w - 8 });
      x += c.w;
    }
    return startY + headerH;
  };
  y = drawTableHeaderAt(y);

  for (const row of report.rows) {
    const notConducted = Math.max(row.paid - row.completed, 0);
    const cells = [
      row.trainerName,
      row.levelName,
      formatSum(row.rate, L.sum),
      String(row.paid),
      String(row.completed),
      row.centerConducted != null ? String(row.centerConducted) : '—',
      String(notConducted),
      formatSumSigned(row.balance, L.sum),
    ];
    const thisRowH = rowHeightFor(doc, cells, colWidths, 9, rowH);
    y = ensureSpace(doc, y, thisRowH, () => drawTableHeaderAt(MARGIN));
    if (row.mismatch) doc.rect(MARGIN, y, pageWidth, thisRowH).fill('#FEF3C7');

    let x = MARGIN;
    cells.forEach((val, i) => {
      const c = cols[i];
      text(doc, val, x + 4, y + 5, {
        size: 9,
        width: c.w - 8,
        color: i === 7 ? (row.balance < 0 ? '#B91C1C' : row.balance > 0 ? '#15803D' : '#111827') : '#111827',
      });
      x += c.w;
    });
    y += thisRowH;
  }

  // Итоговая строка таблицы
  y = ensureSpace(doc, y, rowH, () => drawTableHeaderAt(MARGIN));
  doc.rect(MARGIN, y, pageWidth, rowH).fill('#F3F4F6');
  text(doc, L.total, MARGIN + 4, y + 5, { size: 9, bold: true });
  text(doc, formatSumSigned(report.total, L.sum), MARGIN + pageWidth - cols[7].w + 4, y + 5, {
    size: 9,
    bold: true,
    width: cols[7].w - 8,
  });
  y += rowH + 20;

  // 3. Разбивка непроведённых занятий по причинам
  if (report.missedBreakdown.length) {
    y = ensureSpace(doc, y, 20);
    text(doc, L.missedByReasonTitle, MARGIN, y, { size: 11, bold: true });
    y += 18;
    for (const m of report.missedBreakdown) {
      y = ensureSpace(doc, y, 14);
      const label = L.reasons[m.status] || m.label;
      text(doc, `${label}: ${m.count}`, MARGIN, y, { size: 9 });
      y += 14;
    }
    y += 10;
  }

  // 4. Подробная таблица по дням
  y = ensureSpace(doc, y, 40);
  text(doc, L.dailyDetailTitle, MARGIN, y, { size: 11, bold: true });
  y += 18;

  // "Статус" — самая частая причина переносов (длинные формулировки типа
  // "Болезнь ребёнка (справки нет)", особенно на узбекском), поэтому у неё
  // заметно больше места, чем у "Специалиста" (короткие имена).
  const dCols = [
    { label: L.date, w: 0.13 },
    { label: L.time, w: 0.13 },
    { label: L.trainer, w: 0.18 },
    { label: L.status, w: 0.3 },
    { label: L.note, w: 0.26 },
  ].map((c) => ({ ...c, w: c.w * pageWidth }));
  const dColWidths = dCols.map((c) => c.w);

  const drawDailyHeaderAt = (startY) => {
    const labels = dCols.map((c) => c.label);
    const headerH = rowHeightFor(doc, labels, dColWidths, 8, rowH);
    doc.rect(MARGIN, startY, pageWidth, headerH).fill('#F3F4F6');
    let x = MARGIN;
    for (const c of dCols) {
      text(doc, c.label, x + 4, startY + 5, { size: 8, bold: true, width: c.w - 8 });
      x += c.w;
    }
    return startY + headerH;
  };
  y = drawDailyHeaderAt(y);

  for (const s of sessions) {
    const trainer = s.actualTrainer || s.plannedTrainer;
    const rowVals = [
      formatDateShort(s.date),
      `${s.startTime}–${s.endTime}`,
      trainer ? trainer.name : '',
      L.statusLabels[s.status] || s.status,
      s.note || '',
    ];
    const thisRowH = rowHeightFor(doc, rowVals, dColWidths, 8, rowH);

    if (y + thisRowH > PAGE_BOTTOM) {
      doc.addPage();
      y = drawDailyHeaderAt(MARGIN);
    }

    let x = MARGIN;
    rowVals.forEach((val, i) => {
      const c = dCols[i];
      text(doc, val, x + 4, y + 5, { size: 8, width: c.w - 8 });
      x += c.w;
    });
    y += thisRowH;
  }
  y += 20;

  // 5. Итог крупно
  y = ensureSpace(doc, y, 40);
  text(doc, `${L.total}: ${formatSumSigned(report.total, L.sum)}`, MARGIN, y, {
    size: 16,
    bold: true,
    color: report.total < 0 ? '#B91C1C' : report.total > 0 ? '#15803D' : '#111827',
  });
  y += 50;

  // 6. Подписи
  y = ensureSpace(doc, y, 60);
  const halfW = pageWidth / 2 - 20;
  text(doc, `${L.parent} ______________________`, MARGIN, y, { size: 10, width: halfW });
  text(doc, `${L.centerAdmin} ______________________`, MARGIN + pageWidth / 2, y, { size: 10, width: halfW });

  doc.end();
  return done;
}

module.exports = { buildMonthlyReportPdf };
