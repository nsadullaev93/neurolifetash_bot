'use strict';

// Общая инфраструктура для PDF (ТЗ v2, §2.11, §2.15): шрифты, обёртка над
// mixedText, перенос страницы. Используется и месячным отчётом, и дневником.
const PDFDocument = require('pdfkit');
const path = require('path');
const { PassThrough } = require('stream');
const { mixedText } = require('../utils/pdfText');

// Noto Sans, не Inter — см. подробное объяснение в pdfReport.service.js
// (git-история) и в коммите фазы 9: декомпрессированные из woff2 файлы
// Inter упирались в баг pdfkit/fontkit со смешанным embedding
// латиница+кириллица; после апгрейда pdfkit до 0.20.x баг исчез бы и для
// Inter, но раз Noto Sans уже проверен — незачем менять обратно.
const FONT_DIR = path.join(__dirname, '../../assets/fonts');
const FONTS = {
  latin: path.join(FONT_DIR, 'Noto-Latin-Regular.ttf'),
  latinBold: path.join(FONT_DIR, 'Noto-Latin-SemiBold.ttf'),
  cyr: path.join(FONT_DIR, 'Noto-Cyrillic-Regular.ttf'),
  cyrBold: path.join(FONT_DIR, 'Noto-Cyrillic-SemiBold.ttf'),
  // Noto Sans SC, обрезан до символов, реально используемых в китайском
  // словаре (backend/src/i18n/report.js) — см. scripts/subset-cjk-font.js.
  // Полный шрифт с китайскими иероглифами весит 8-17 МБ; обрезанный — на
  // три порядка меньше, т.к. в PDF нужен только фиксированный набор из
  // ~60 иероглифов словаря, а не вся китайская письменность.
  cjk: path.join(FONT_DIR, 'Noto-CJK-SC-Subset-Regular.ttf'),
  cjkBold: path.join(FONT_DIR, 'Noto-CJK-SC-Subset-Bold.ttf'),
};

const MARGIN = 40;
const PAGE_BOTTOM = 842 - MARGIN; // A4 height in pt minus margin

function createPdfDoc() {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  doc.registerFont('regular-latin', FONTS.latin);
  doc.registerFont('bold-latin', FONTS.latinBold);
  doc.registerFont('regular-cyr', FONTS.cyr);
  doc.registerFont('bold-cyr', FONTS.cyrBold);
  doc.registerFont('regular-cjk', FONTS.cjk);
  doc.registerFont('bold-cjk', FONTS.cjkBold);

  const stream = new PassThrough();
  doc.pipe(stream);
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => stream.on('end', () => resolve(Buffer.concat(chunks))));

  return { doc, done, pageWidth: doc.page.width - MARGIN * 2 };
}

function text(doc, str, x, y, opts = {}) {
  const bold = !!opts.bold;
  doc.fontSize(opts.size || 10);
  doc.fillColor(opts.color || '#111827');
  mixedText(doc, str, x, y, {
    latinFont: bold ? 'bold-latin' : 'regular-latin',
    cyrFont: bold ? 'bold-cyr' : 'regular-cyr',
    cjkFont: bold ? 'bold-cjk' : 'regular-cjk',
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

module.exports = { createPdfDoc, text, ensureSpace, formatSum, formatSumSigned, MARGIN, PAGE_BOTTOM };
