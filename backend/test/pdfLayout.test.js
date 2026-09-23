// Чистая логика вёрстки PDF-таблиц, без БД. Регрессия 23.09.2026: строки
// таблиц отчёта раньше имели жёстко зашитую высоту (20pt) — длинный текст
// (например, статус "Болезнь ребёнка (справки нет)" в узкой колонке)
// переносился на 2-3 строки и наезжал на следующую строку таблицы.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPdfDoc, measureHeight, textRight } = require('../src/services/pdfBase');

test('measureHeight растёт при переносе текста на несколько строк', () => {
  const { doc } = createPdfDoc();
  const short = measureHeight(doc, 'Проведено', 200, 8);
  const long = measureHeight(doc, 'Болезнь ребёнка (справки нет)', 60, 8);
  assert.ok(long > short, 'длинный текст в узкой колонке должен занимать больше места по высоте');
});

test('measureHeight не бросает исключение на пустой/смешанной строке', () => {
  const { doc } = createPdfDoc();
  assert.doesNotThrow(() => measureHeight(doc, '', 100, 9));
  assert.doesNotThrow(() => measureHeight(doc, null, 100, 9));
  assert.doesNotThrow(() => measureHeight(doc, undefined, 100, 9));
  assert.doesNotThrow(() => measureHeight(doc, 'Специалист: Усмон, 230 000 сум', 100, 9));
  assert.doesNotThrow(() => measureHeight(doc, '专家: 苏姆 123', 100, 9));
});

test('measureHeight одинаковой строки одинакова при повторном вызове (детерминизм)', () => {
  const { doc } = createPdfDoc();
  const a = measureHeight(doc, 'Специалист отсутствовал', 80, 8);
  const b = measureHeight(doc, 'Специалист отсутствовал', 80, 8);
  assert.equal(a, b);
});

// Регрессия 23.09.2026: правое выравнивание смешанного (кириллица+латиница)
// текста через align:'right' в PDFKit ломалось при переключении шрифта
// посреди строки (например, "+460 000 сум" рисовалось с наложением цифр
// и слова "сум" друг на друга). textRight считает позицию сама, минуя
// align. Тут только smoke-test — что не падает на разных языках/весах
// шрифта; фактическая проверка "не накладывается" — визуальная, сделана
// генерацией реального PDF при разработке фикса.
test('textRight не бросает исключение для смешанного текста на разных языках', () => {
  const { doc, pageWidth } = createPdfDoc();
  assert.doesNotThrow(() => textRight(doc, '+460 000 сум', pageWidth, 40, { size: 12, bold: true }));
  assert.doesNotThrow(() => textRight(doc, '+460 000 so\'m', pageWidth, 60, { size: 12, bold: true }));
  assert.doesNotThrow(() => textRight(doc, '+460 000 苏姆', pageWidth, 80, { size: 12, bold: true }));
  assert.doesNotThrow(() => textRight(doc, '', pageWidth, 100, {}));
  assert.doesNotThrow(() => textRight(doc, null, pageWidth, 120, {}));
});
