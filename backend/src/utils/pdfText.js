'use strict';

// Встроенные шрифты PDF не содержат кириллицы, узбекских символов или
// китайских иероглифов (ТЗ v2, §2.11), поэтому используем Noto Sans — но
// файлы шрифта разбиты по подмножествам: "latin" — базовая латиница и ВСЯ
// пунктуация/цифры, "cyrillic" — только кириллические буквы без пунктуации,
// "cjk" — только китайские иероглифы, используемые в словаре (см. генерацию
// в scripts/subset-cjk-font.js). Реальный текст отчёта смешивает несколько
// алфавитов (например, "Специалист: Усмон, 230 000 сум" или китайская
// подпись с числом), поэтому строка режется на куски по принадлежности к
// алфавиту и каждый кусок рисуется своим шрифтом.
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const CJK_RE = /[一-鿿]/;

function classify(ch) {
  if (CYRILLIC_RE.test(ch)) return 'cyr';
  if (CJK_RE.test(ch)) return 'cjk';
  return 'latin';
}

function splitRuns(text) {
  const runs = [];
  let current = '';
  let currentClass = null;

  for (const ch of String(text)) {
    const cls = classify(ch);
    if (currentClass === null || cls === currentClass) {
      current += ch;
      currentClass = cls;
    } else {
      runs.push({ text: current, cls: currentClass });
      current = ch;
      currentClass = cls;
    }
  }
  if (current) runs.push({ text: current, cls: currentClass });
  return runs;
}

function fontFor(cls, { latinFont, cyrFont, cjkFont }) {
  if (cls === 'cyr') return cyrFont;
  if (cls === 'cjk') return cjkFont || latinFont;
  return latinFont;
}

// Печатает строку, переключая шрифт между latinFont/cyrFont/cjkFont по мере
// необходимости. x/y — опциональны (как в PDFKit .text()); options —
// обычные опции PDFKit .text() (кроме continued, им управляет сама функция).
function mixedText(doc, text, x, y, { latinFont, cyrFont, cjkFont, ...options } = {}) {
  // Разрешаем вызов и без x/y: mixedText(doc, text, { latinFont, cyrFont, ... })
  if (typeof x === 'object' && x !== null) {
    options = x;
    latinFont = options.latinFont;
    cyrFont = options.cyrFont;
    cjkFont = options.cjkFont;
    x = undefined;
    y = undefined;
    delete options.latinFont;
    delete options.cyrFont;
    delete options.cjkFont;
  }

  const runs = splitRuns(text);
  runs.forEach((run, i) => {
    doc.font(fontFor(run.cls, { latinFont, cyrFont, cjkFont }));
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
function mixedWidth(doc, text, { latinFont, cyrFont, cjkFont, fontSize } = {}) {
  const runs = splitRuns(text);
  return runs.reduce((sum, run) => {
    doc.font(fontFor(run.cls, { latinFont, cyrFont, cjkFont }));
    if (fontSize) doc.fontSize(fontSize);
    return sum + doc.widthOfString(run.text);
  }, 0);
}

module.exports = { mixedText, mixedWidth, splitRuns };
