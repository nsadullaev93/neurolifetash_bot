const ExcelJS = require('exceljs');
const config = require('../config/default');
const SessionModel = require('../models/Session');
const { calculateMonthlyReconciliation } = require('./reconciliation.service');
const { monthName } = require('../utils/date');

async function getMonthlyReport(year, month) {
  const reconciliation = await calculateMonthlyReconciliation(year, month);
  const sessions = await SessionModel.listForMonth(year, month);

  const missedCounts = {};
  for (const s of sessions) {
    if (s.status === 'COMPLETED' || s.status === 'MAKEUP' || s.status === 'PLANNED') continue;
    missedCounts[s.status] = (missedCounts[s.status] || 0) + 1;
  }

  const missedBreakdown = Object.entries(missedCounts).map(([status, count]) => ({
    status,
    label: config.statusLabels[status],
    count,
  }));

  return { ...reconciliation, missedBreakdown };
}

async function exportMonthlyXlsx(year, month) {
  const report = await getMonthlyReport(year, month);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Сверка ${month}.${year}`);

  sheet.columns = [
    { header: 'Специалист', key: 'trainerName', width: 22 },
    { header: 'Уровень', key: 'levelName', width: 14 },
    { header: 'Ставка', key: 'rate', width: 14 },
    { header: 'План', key: 'plan', width: 10 },
    { header: 'Оплачено', key: 'paid', width: 12 },
    { header: 'Проведено', key: 'completed', width: 12 },
    { header: 'Баланс', key: 'balance', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of report.rows) {
    sheet.addRow({
      trainerName: row.trainerName,
      levelName: row.levelName,
      rate: row.rate,
      plan: row.plan,
      paid: row.paid,
      completed: row.completed,
      balance: row.balance,
    });
  }

  sheet.addRow({});
  const totalRow = sheet.addRow({ trainerName: 'Итого', balance: report.total });
  totalRow.font = { bold: true };

  sheet.addRow({});
  const reasonsHeaderRow = sheet.addRow({ trainerName: 'Пропуски по причинам' });
  reasonsHeaderRow.font = { bold: true };
  for (const m of report.missedBreakdown) {
    sheet.addRow({ trainerName: m.label, plan: m.count });
  }

  sheet.getColumn('rate').numFmt = '#,##0';
  sheet.getColumn('balance').numFmt = '#,##0';

  const titleSheet = workbook.getWorksheet(`Сверка ${month}.${year}`);
  titleSheet.insertRow(1, [`Сверка занятий — ${monthName(month)} ${year}`]);
  titleSheet.mergeCells('A1:G1');
  titleSheet.getCell('A1').font = { bold: true, size: 14 };

  return workbook.xlsx.writeBuffer();
}

module.exports = { getMonthlyReport, exportMonthlyXlsx };
