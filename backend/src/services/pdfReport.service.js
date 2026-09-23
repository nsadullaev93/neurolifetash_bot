'use strict';

const { getMonthlyReport } = require('./report.service');
const SessionModel = require('../models/Session');
const { t, monthYearLabel, formatDateFor } = require('../i18n/report');
const { formatDateShort, isoWeekday } = require('../utils/date');
const {
  createPdfDoc,
  text,
  textRight,
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

// Понедельник той недели, к которой относится дата — используется только
// для сравнения "сменилась ли неделя" между соседними занятиями, не для
// отображения.
function mondayOf(d) {
  const x = new Date(d);
  const wd = isoWeekday(x); // 1..7
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() - (wd - 1));
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

  // 2. Сводка по специалистам — карточка на каждого, не таблица с колонками.
  // Раньше это была таблица из 8 узких колонок (Специалист/Уровень/Ставка/
  // Оплачено/Проведено/По данным центра/Не проведено/Баланс), и при любом
  // языке рано или поздно находилась колонка, куда не влезало даже одно
  // слово без переноса середины слова (например, "Начальный" в колонке
  // "Уровень"). Вертикальная карточка не имеет такого ограничения вообще —
  // у каждой строки вся ширина страницы. Заодно отвечает на прямой запрос:
  // сколько оплачено деньгами, сколько реально потрачено на проведённые
  // занятия и чему равна разница между ними (это и есть баланс).
  let totalPaidMoney = 0;
  let totalSpentMoney = 0;

  for (const row of report.rows) {
    const paidMoney = row.paid * row.rate;
    const spentMoney = paidMoney - row.balance; // = "сколько денег ушло на реально проведённые занятия"
    totalPaidMoney += paidMoney;
    totalSpentMoney += spentMoney;
    const notConducted = Math.max(row.paid - row.completed, 0);
    const balanceColor = row.balance < 0 ? '#B91C1C' : row.balance > 0 ? '#15803D' : '#111827';

    const cardH = row.discountApplied ? 103 : 90;
    y = ensureSpace(doc, y, cardH);
    if (row.mismatch) {
      doc.rect(MARGIN, y - 4, pageWidth, cardH + 2).fill('#FEF3C7');
    }

    text(doc, `${row.trainerName} · ${row.levelName}`, MARGIN, y, { size: 12, bold: true, width: pageWidth - 140 });
    textRight(doc, formatSumSigned(row.balance, L.sum), MARGIN + pageWidth, y, {
      size: 12,
      bold: true,
      color: balanceColor,
    });
    y += 18;

    text(doc, `${L.rate}: ${formatSum(row.rate, L.sum)}`, MARGIN, y, { size: 9, color: '#374151' });
    y += 13;
    text(
      doc,
      `${L.paid}: ${row.paid} ${L.sessionsUnit} · ${formatSum(paidMoney, L.sum)}`,
      MARGIN,
      y,
      { size: 9, color: '#374151' },
    );
    y += 13;
    let conductedLine = `${L.conducted}: ${row.completed} ${L.sessionsUnit}`;
    if (row.centerConducted != null) {
      conductedLine += ` (${L.centerConducted.toLowerCase()}: ${row.centerConducted})`;
    }
    text(doc, conductedLine, MARGIN, y, { size: 9, color: '#374151' });
    y += 13;
    text(doc, `${L.notConducted}: ${notConducted} ${L.sessionsUnit}`, MARGIN, y, { size: 9, color: '#374151' });
    y += 13;
    text(doc, `${L.spentOnConducted}: ${formatSum(spentMoney, L.sum)}`, MARGIN, y, {
      size: 9,
      bold: true,
      color: '#374151',
    });
    y += 20;
    if (row.discountApplied) {
      text(doc, L.discountApplied, MARGIN, y, { size: 9, bold: true, color: '#15803D' });
      y += 13;
    }
  }

  y += 6;

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

  // 4. Подробная таблица по дням. Дата больше не повторяется на каждой
  // строке (в один день обычно 2-3 занятия у разных специалистов) —
  // показывается один раз на первую строку дня, дальше пусто до конца
  // группы. Между днями — тонкая линия, между неделями — увеличенный отступ
  // и линия потолще, чтобы месяц читался как настоящий журнал по неделям,
  // а не сплошной список одинаковых на вид строк.
  y = ensureSpace(doc, y, 40);
  text(doc, L.dailyDetailTitle, MARGIN, y, { size: 11, bold: true });
  y += 18;

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
    const headerH = rowHeightFor(doc, labels, dColWidths, 8, 20);
    doc.rect(MARGIN, startY, pageWidth, headerH).fill('#F3F4F6');
    let x = MARGIN;
    for (const c of dCols) {
      text(doc, c.label, x + 4, startY + 5, { size: 8, bold: true, width: c.w - 8 });
      x += c.w;
    }
    return startY + headerH;
  };
  y = drawDailyHeaderAt(y);

  let prevDateKey = null;
  let prevWeekKey = null;

  for (const s of sessions) {
    const trainer = s.actualTrainer || s.plannedTrainer;
    const dateKey = new Date(s.date).getTime();
    const weekKey = mondayOf(s.date);
    const isNewDay = dateKey !== prevDateKey;
    const isNewWeek = isNewDay && prevWeekKey !== null && weekKey !== prevWeekKey;

    const rowVals = [
      isNewDay ? formatDateShort(s.date) : '',
      `${s.startTime}–${s.endTime}`,
      trainer ? trainer.name : '',
      L.statusLabels[s.status] || s.status,
      s.note || '',
    ];
    const thisRowH = rowHeightFor(doc, rowVals, dColWidths, 8, 20);
    const extraGap = isNewWeek ? 10 : 0;

    if (y + extraGap + thisRowH > PAGE_BOTTOM) {
      doc.addPage();
      y = drawDailyHeaderAt(MARGIN);
    } else if (isNewWeek) {
      doc
        .moveTo(MARGIN, y + 4)
        .lineTo(MARGIN + pageWidth, y + 4)
        .lineWidth(1.2)
        .strokeColor('#9CA3AF')
        .stroke();
      y += extraGap;
    } else if (isNewDay && prevDateKey !== null) {
      doc
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + pageWidth, y)
        .lineWidth(0.5)
        .strokeColor('#E5E7EB')
        .stroke();
    }

    let x = MARGIN;
    rowVals.forEach((val, i) => {
      const c = dCols[i];
      text(doc, val, x + 4, y + 5, { size: 8, width: c.w - 8 });
      x += c.w;
    });
    y += thisRowH;
    prevDateKey = dateKey;
    prevWeekKey = weekKey;
  }
  y += 20;

  // 5. Итог крупно — сумма, реально потраченная на проведённые занятия (а
  // не остаточный баланс: баланс уже виден по каждому специалисту выше,
  // здесь по прямому запросу — именно то, что фактически стоили занятия
  // месяца). Оплачено и баланс показаны рядом мельче для контекста.
  y = ensureSpace(doc, y, 70);
  text(doc, `${L.paid}: ${formatSum(totalPaidMoney, L.sum)}`, MARGIN, y, { size: 10, color: '#374151' });
  y += 16;
  text(doc, `${L.spentOnConducted}: ${formatSum(totalSpentMoney, L.sum)}`, MARGIN, y, {
    size: 18,
    bold: true,
  });
  y += 26;
  text(doc, `${L.balance}: ${formatSumSigned(report.total, L.sum)}`, MARGIN, y, {
    size: 10,
    bold: true,
    color: report.total < 0 ? '#B91C1C' : report.total > 0 ? '#15803D' : '#111827',
  });
  y += 40;

  // 6. Подписи
  y = ensureSpace(doc, y, 60);
  const halfW = pageWidth / 2 - 20;
  text(doc, `${L.parent} ______________________`, MARGIN, y, { size: 10, width: halfW });
  text(doc, `${L.centerAdmin} ______________________`, MARGIN + pageWidth / 2, y, { size: 10, width: halfW });

  doc.end();
  return done;
}

module.exports = { buildMonthlyReportPdf };
