'use strict';

const { getMonthlyReport } = require('./report.service');
const SessionModel = require('../models/Session');
const { t, monthYearLabel, formatDateFor } = require('../i18n/report');
const { formatDateShort } = require('../utils/date');
const { createPdfDoc, text, ensureSpace, formatSum, formatSumSigned, MARGIN, PAGE_BOTTOM } = require('./pdfBase');

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

  // 2. Сводная таблица по специалистам
  const cols = [
    { key: 'trainer', label: L.trainer, w: 0.13 },
    { key: 'level', label: L.level, w: 0.11 },
    { key: 'rate', label: L.rate, w: 0.14 },
    { key: 'paid', label: L.paid, w: 0.09 },
    { key: 'conducted', label: L.conducted, w: 0.1 },
    { key: 'center', label: L.centerConducted, w: 0.14 },
    { key: 'notConducted', label: L.notConducted, w: 0.1 },
    { key: 'balance', label: L.balance, w: 0.2 },
  ].map((c) => ({ ...c, w: c.w * pageWidth }));

  const rowH = 20;
  const headerRowH = 34; // некоторые заголовки (узбекские) переносятся на 2-3 строки
  const drawTableHeader = () => {
    let x = MARGIN;
    doc.rect(MARGIN, y, pageWidth, headerRowH).fill('#F3F4F6');
    for (const c of cols) {
      text(doc, c.label, x + 4, y + 5, { size: 7, bold: true, width: c.w - 8 });
      x += c.w;
    }
    y += headerRowH;
  };
  drawTableHeader();

  for (const row of report.rows) {
    y = ensureSpace(doc, y, rowH);
    const notConducted = Math.max(row.paid - row.completed, 0);
    if (row.mismatch) doc.rect(MARGIN, y, pageWidth, rowH).fill('#FEF3C7');

    let x = MARGIN;
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
    cells.forEach((val, i) => {
      const c = cols[i];
      text(doc, val, x + 4, y + 5, {
        size: 9,
        width: c.w - 8,
        color: i === 7 ? (row.balance < 0 ? '#B91C1C' : row.balance > 0 ? '#15803D' : '#111827') : '#111827',
      });
      x += c.w;
    });
    y += rowH;
  }

  // Итоговая строка таблицы
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

  const dCols = [
    { label: L.date, w: 0.14 },
    { label: L.time, w: 0.14 },
    { label: L.trainer, w: 0.22 },
    { label: L.status, w: 0.26 },
    { label: L.note, w: 0.24 },
  ].map((c) => ({ ...c, w: c.w * pageWidth }));

  const drawDailyHeader = () => {
    let x = MARGIN;
    doc.rect(MARGIN, y, pageWidth, rowH).fill('#F3F4F6');
    for (const c of dCols) {
      text(doc, c.label, x + 4, y + 5, { size: 8, bold: true, width: c.w - 8 });
      x += c.w;
    }
    y += rowH;
  };
  drawDailyHeader();

  for (const s of sessions) {
    if (y + rowH > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawDailyHeader();
    }
    const trainer = s.actualTrainer || s.plannedTrainer;
    let x = MARGIN;
    const rowVals = [
      formatDateShort(s.date),
      `${s.startTime}–${s.endTime}`,
      trainer ? trainer.name : '',
      L.statusLabels[s.status] || s.status,
      s.note || '',
    ];
    rowVals.forEach((val, i) => {
      const c = dCols[i];
      text(doc, val, x + 4, y + 5, { size: 8, width: c.w - 8 });
      x += c.w;
    });
    y += rowH;
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
