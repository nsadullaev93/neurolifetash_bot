'use strict';

// Генерирует обрезанные китайские шрифты для PDF-отчётов (assets/fonts/
// Noto-CJK-SC-Subset-{Regular,Bold}.ttf) — только символы, реально
// используемые в словаре backend/src/i18n/report.js (zh). Полный Noto Sans
// SC весит 8-17 МБ на один начертание; обрезанный до ~60 иероглифов —
// единицы КБ. Перезапускать при добавлении новых китайских строк в словарь
// (иначе новые иероглифы не найдут глифа и не отрисуются). Не входит в
// обычный `npm install`/деплой — разовый инструмент, запускается вручную:
//
//   node scripts/subset-cjk-font.js
//
// Источник — статический OTF-субсет Simplified Chinese из репозитория
// Google Noto (notofonts/noto-cjk), лицензия SIL OFL 1.1.
const fs = require('fs');
const path = require('path');
const subsetFont = require('subset-font');
const { t, monthNameFor } = require('../src/i18n/report');

const SOURCES = {
  Regular: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf',
  Bold: 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Bold.otf',
};
const OUT_DIR = path.join(__dirname, '../assets/fonts');

function collectStrings(obj, out) {
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') collectStrings(v, out);
  }
}

function buildCharset() {
  const strings = [];
  collectStrings(t('zh'), strings);
  for (let m = 1; m <= 12; m++) strings.push(monthNameFor('zh', m));
  strings.push('年月日'); // формат даты "2026年9月21日" —日 больше нигде не встречается
  const text = strings.join('');
  const chars = [...new Set([...text])].sort().join('');
  return chars;
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const charset = buildCharset();
  console.log(`Символов в наборе: ${charset.length}`);
  console.log(charset);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const [weight, url] of Object.entries(SOURCES)) {
    console.log(`\nСкачиваю ${weight} из ${url} ...`);
    const source = await fetchBuffer(url);
    console.log(`Исходный размер: ${(source.length / 1024 / 1024).toFixed(1)} МБ`);

    const subset = await subsetFont(source, charset, { targetFormat: 'sfnt' });
    const outPath = path.join(OUT_DIR, `Noto-CJK-SC-Subset-${weight}.ttf`);
    fs.writeFileSync(outPath, subset);
    console.log(`Записано ${outPath}: ${(subset.length / 1024).toFixed(1)} КБ`);
  }

  console.log('\nГотово.');
}

main().catch((err) => {
  console.error('ОШИБКА:', err);
  process.exitCode = 1;
});
