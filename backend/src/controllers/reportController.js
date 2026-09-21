const { getMonthlyReport, exportMonthlyXlsx } = require('../services/report.service');
const {
  calculateForecast,
  calculatePaymentStatus,
  getUnconfirmedHolidayWarnings,
} = require('../services/forecast.service');

function parseYearMonth(req, res) {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: 'Укажите корректные year и month' });
    return null;
  }
  return { year, month };
}

async function monthly(req, res, next) {
  try {
    const ym = parseYearMonth(req, res);
    if (!ym) return;
    const report = await getMonthlyReport(ym.year, ym.month);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function forecast(req, res, next) {
  try {
    const ym = parseYearMonth(req, res);
    if (!ym) return;
    const result = await calculateForecast(ym.year, ym.month);
    const holidayWarnings = await getUnconfirmedHolidayWarnings(ym.year, ym.month);
    res.json({ ...result, holidayWarnings });
  } catch (err) {
    next(err);
  }
}

async function paymentStatus(req, res, next) {
  try {
    const ym = parseYearMonth(req, res);
    if (!ym) return;
    const result = await calculatePaymentStatus(ym.year, ym.month);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function exportMonthly(req, res, next) {
  try {
    const ym = parseYearMonth(req, res);
    if (!ym) return;
    const buffer = await exportMonthlyXlsx(ym.year, ym.month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${ym.year}-${String(ym.month).padStart(2, '0')}.xlsx"`,
    );
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

module.exports = { monthly, forecast, paymentStatus, exportMonthly };
