// Чистая логика вёрстки PDF-таблиц, без БД. Регрессия 23.09.2026: строки
// таблиц отчёта раньше имели жёстко зашитую высоту (20pt) — длинный текст
// (например, статус "Болезнь ребёнка (справки нет)" в узкой колонке)
// переносился на 2-3 строки и наезжал на следующую строку таблицы.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPdfDoc, measureHeight } = require('../src/services/pdfBase');

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
