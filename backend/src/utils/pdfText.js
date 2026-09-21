'use strict';

// Встроенные шрифты PDF не содержат кириллицы и узбекских символов (ТЗ v2,
// §2.11), поэтому используем Inter — но файлы шрифта, доступные как обычные
// .ttf (не переменные), разбиты по подмножествам: "latin" содержит базовую
// латиницу и ВСЮ пунктуацию/цифры, "cyrillic" — только кириллические буквы,
// без пунктуации. Реальный текст отчёта всегда смешивает оба (например,
// "Специалист: Усмон, 230 000 сум"), поэтому строка режется на куски по
// принадлежности к кириллице и каждый кусок рисуется своим шрифтом.
const CYRILLIC_RE = /[Ѐ-ӿ]/;

function splitRuns(text) {
  const runs = [];
  let current = '';
  let currentIsCyr = null;

  for (const ch of String(text)) {
    const isCyr = CYRILLIC_RE.test(ch);
    if (currentIsCyr === null || isCyr === currentIsCyr) {
      current += ch;
      currentIsCyr = isCyr;
    } else {
      runs.push({ text: current, cyr: currentIsCyr });
      current = ch;
      currentIsCyr = isCyr;
    }
  }
  if (current) runs.push({ text: current, cyr: currentIsCyr });
  return runs;
}

// Печатает строку, переключая шрифт между latinFont/cyrFont по мере
// необходимости. x/y — опциональны (как в PDFKit .text()); options —
// обычные опции PDFKit .text() (кроме continued, им управляет сама функция).
function mixedText(doc, text, x, y, { latinFont, cyrFont, ...options } = {}) {
  // Разрешаем вызов и без x/y: mixedText(doc, text, { latinFont, cyrFont, ... })
  if (typeof x === 'object' && x !== null) {
    options = x;
    latinFont = options.latinFont;
    cyrFont = options.cyrFont;
    x = undefined;
    y = undefined;
    delete options.latinFont;
    delete options.cyrFont;
  }

  const runs = splitRuns(text);
  runs.forEach((run, i) => {
    doc.font(run.cyr ? cyrFont : latinFont);
    const opts = { ...options, continued: i < runs.length - 1 };
    if (i === 0 && x !== undefined && y !== undefined) {
      doc.text(run.text, x, y, opts);
    } else {
      doc.text(run.text, opts);
    }
  });
}

// Ширина строки с учётом переключения шрифтов — нужна для ручной вёрстки
// таблиц (PDFKit .widthOfString сам не умеет мешать шрифты).
function mixedWidth(doc, text, { latinFont, cyrFont, fontSize } = {}) {
  const runs = splitRuns(text);
  return runs.reduce((sum, run) => {
    doc.font(run.cyr ? cyrFont : latinFont);
    if (fontSize) doc.fontSize(fontSize);
    return sum + doc.widthOfString(run.text);
  }, 0);
}

module.exports = { mixedText, mixedWidth, splitRuns };
