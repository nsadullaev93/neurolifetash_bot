'use strict';

// Общая инфраструктура для PDF (ТЗ v2, §2.11, §2.15): шрифты, обёртка над
// mixedText, перенос страницы. Используется и месячным отчётом, и дневником.
const PDFDocument = require('pdfkit');
const path = require('path');
const { PassThrough } = require('stream');
const { mixedText, splitRuns } = require('../utils/pdfText');

const CLASS_TO_FONT = { cyr: 'regular-cyr', cjk: 'regular-cjk', latin: 'regular-latin' };

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

// Правое выравнивание для смешанного (кириллица+латиница+CJK) текста —
// НЕ через опцию align:'right' в PDFKit. Баг, найденный 23.09.2026: когда
// mixedText переключает шрифт посреди строки (несколько вызовов doc.text
// с continued:true), align:'right' с явным width заставляет PDFKit
// пересчитывать позицию для КАЖДОГО куска независимо — куски накладываются
// друг на друга вместо того, чтобы просто идти подряд (например, "+460 000
// сум" рисовалось как "+460 000" и "сум" почти в одной точке). Вместо этого
// сами меряем ширину строки (mixedWidth, как в measureHeight — тем
// шрифтом, чьи символы реально есть в каждом куске) и рисуем обычным
// left-aligned text() от вычисленной x = правый_край - ширина.
function textRight(doc, str, rightEdgeX, y, opts = {}) {
  const bold = !!opts.bold;
  const fontFor = (cls) => `${bold ? 'bold' : 'regular'}-${cls}`;
  doc.fontSize(opts.size || 10);
  const runs = splitRuns(String(str ?? ''));
  const width = runs.reduce((sum, run) => {
    doc.font(fontFor(run.cls));
    return sum + doc.widthOfString(run.text);
  }, 0);
  text(doc, str, rightEdgeX - width, y, { ...opts, width: undefined, align: undefined });
}

function ensureSpace(doc, y, needed, onNewPage) {
  if (y + needed > PAGE_BOTTOM) {
    doc.addPage();
    return onNewPage ? onNewPage() : MARGIN;
  }
  return y;
}

// Реальная высота строки текста в заданной ширине — нужна для таблиц, чтобы
// строка с длинным текстом (длинные статусы/причины на узбекском, длинные
// заметки) переносилась на несколько строк, не наезжая на следующую строку
// таблицы. PDFKit меряет высоту только для ОДНОГО активного шрифта за раз, а
// в ячейке может быть смесь кириллицы/латиницы/китайского (mixedText).
// Меряем только теми шрифтами, чьи символы реально есть в строке (через тот
// же classify(), что и сама отрисовка, — splitRuns) и берём максимум: если
// мерить ЛЮБЫМ шрифтом подряд (включая тот, где для этих символов нет
// глифов — например, китайским для кириллического текста), PDFKit подставит
// widthless/notdef-глифы со своей шириной, и оценка получится сильно
// завышенной — отсюда были неоправданно большие пустые промежутки между
// строками с длинными заметками.
function measureHeight(doc, str, width, fontSize) {
  const s = str === undefined || str === null || str === '' ? ' ' : String(str);
  const classes = new Set(splitRuns(s).map((r) => r.cls));
  let max = 0;
  for (const cls of classes) {
    doc.font(CLASS_TO_FONT[cls]);
    doc.fontSize(fontSize);
    const h = doc.heightOfString(s, { width });
    if (h > max) max = h;
  }
  return max;
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

module.exports = {
  createPdfDoc,
  text,
  textRight,
  ensureSpace,
  measureHeight,
  formatSum,
  formatSumSigned,
  MARGIN,
  PAGE_BOTTOM,
};
