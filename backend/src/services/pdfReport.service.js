'use strict';

const PDFDocument = require('pdfkit');
const path = require('path');
const { PassThrough } = require('stream');
const { getMonthlyReport } = require('./report.service');
const SessionModel = require('../models/Session');
const { mixedText, mixedWidth } = require('../utils/pdfText');
const { t, monthNameFor, formatDateFor } = require('../i18n/report');
const { formatDateShort } = require('../utils/date');

// Шрифт — Noto Sans, не Inter (ТЗ v2, §2.11, п. "если нет — использовать
// Noto Sans"): decompress-из-woff2 файлы Inter давали баг конкретно в
// pdfkit/fontkit при одновременной загрузке латинского и кириллического
// подмножеств — часть кириллических слов переставала рисоваться, стоило
// зарегистрировать оба шрифта в одном документе. У Noto Sans той же
// проблемы нет — проверено на реальном тексте отчёта, включая ʻ/o‘ и g‘.
const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const F = {
  latin: path.join(FONT_DIR, 'Noto-Latin-Regular.ttf'),
  latinBold: path.join(FONT_DIR, 'Noto-Latin-SemiBold.ttf'),
  cyr: path.join(FONT_DIR, 'Noto-Cyrillic-Regular.ttf'),
  cyrBold: path.join(FONT_DIR, 'Noto-Cyrillic-SemiBold.ttf'),
};

const MARGIN = 40;
const PAGE_BOTTOM = 842 - MARGIN; // A4 height in pt minus margin

function formatSum(amount, sumLabel) {
  const abs = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${amount < 0 ? '−' : ''}${abs} ${sumLabel}`;
}

function formatSumSigned(amount, sumLabel) {
  if (amount > 0) return `+${formatSum(amount, sumLabel)}`;
  return formatSum(amount, sumLabel);
}

function registerFonts(doc) {
  doc.registerFont('regular-latin', F.latin);
  doc.registerFont('bold-latin', F.latinBold);
  doc.registerFont('regular-cyr', F.cyr);
  doc.registerFont('bold-cyr', F.cyrBold);
}

function text(doc, str, x, y, opts = {}) {
  const bold = !!opts.bold;
  doc.fontSize(opts.size || 10);
  doc.fillColor(opts.color || '#111827');
  mixedText(doc, str, x, y, {
    latinFont: bold ? 'bold-latin' : 'regular-latin',
    cyrFont: bold ? 'bold-cyr' : 'regular-cyr',
    width: opts.width,
    align: opts.align || 'left',
    lineBreak: opts.lineBreak !== false,
  });
}

function ensureSpace(doc, y, needed, onNewPage) {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return onNewPage ? onNewPage() : MARGIN;
  }
  return y;
}

async function buildMonthlyReportPdf(year, month, lang, childName) {
  const L = t(lang);
  const report = await getMonthlyReport(year, month);
  const sessions = await SessionModel.listForMonth(year, month);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  registerFonts(doc);

  const stream = new PassThrough();
  doc.pipe(stream);
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => stream.on('end', () => resolve(Buffer.concat(chunks))));

  const pageWidth = doc.page.width - MARGIN * 2;
  let y = MARGIN;

  // 1. Шапка
  text(doc, L.reportTitle, MARGIN, y, { size: 18, bold: true });
  y += 26;
  const monthLabel = monthNameFor(lang, month);
  text(doc, `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${year}`, MARGIN, y, { size: 12, bold: true });
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
    const highlighted = row.mismatch;
    if (highlighted) doc.rect(MARGIN, y, pageWidth, rowH).fill('#FEF3C7');

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
      text(doc, val, x + 4, y + 5, { size: 9, width: c.w - 8, color: i === 7 ? (row.balance < 0 ? '#B91C1C' : row.balance > 0 ? '#15803D' : '#111827') : '#111827' });
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
    y = ensureSpace(doc, y, 20, () => MARGIN);
    text(doc, L.missedByReasonTitle, MARGIN, y, { size: 11, bold: true });
    y += 18;
    for (const m of report.missedBreakdown) {
      y = ensureSpace(doc, y, 14, () => MARGIN);
      const label = L.reasons[m.status] || m.label;
      text(doc, `${label}: ${m.count}`, MARGIN, y, { size: 9 });
      y += 14;
    }
    y += 10;
  }

  // 4. Подробная таблица по дням
  y = ensureSpace(doc, y, 40, () => MARGIN);
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
  y = ensureSpace(doc, y, 40, () => MARGIN);
  text(doc, `${L.total}: ${formatSumSigned(report.total, L.sum)}`, MARGIN, y, {
    size: 16,
    bold: true,
    color: report.total < 0 ? '#B91C1C' : report.total > 0 ? '#15803D' : '#111827',
  });
  y += 50;

  // 6. Подписи
  y = ensureSpace(doc, y, 60, () => MARGIN);
  const halfW = pageWidth / 2 - 20;
  text(doc, `${L.parent} ______________________`, MARGIN, y, { size: 10, width: halfW });
  text(doc, `${L.centerAdmin} ______________________`, MARGIN + pageWidth / 2, y, { size: 10, width: halfW });

  doc.end();
  return done;
}

module.exports = { buildMonthlyReportPdf };
