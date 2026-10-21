import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { formatMoney, formatMoneySigned, balanceColor, RU_MONTHS_NOM } from '../utils/format';
import { downloadBlob } from '../utils/download';

const now = new Date();

export default function ReportReconciliation() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState('');
  const [pdfSent, setPdfSent] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await api.getMonthlyReport(year, month);
      setReport(result);
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const blob = await api.exportMonthlyBlob(year, month);
      downloadBlob(blob, `report-${year}-${String(month).padStart(2, '0')}.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf(lang) {
    setExportingPdf(lang);
    setPdfSent(false);
    setError('');
    try {
      await api.sendReportPdf(year, month, lang);
      setPdfSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingPdf('');
    }
  }

  // Специалист без плана, оплат, занятий и переноса (например, в отпуске
  // весь месяц) — пустая строка с нулями, только шум.
  const visibleRows = report
    ? report.rows.filter((r) => r.plan || r.paid || r.completed || r.carryIn || r.balance)
    : [];

  return (
    <>
      {error && <div className="error-box">{error}</div>}

      <div className="calendar-header">
        <button className="icon-btn" onClick={prevMonth}>‹</button>
        <h2>{RU_MONTHS_NOM[month - 1]} {year}</h2>
        <button className="icon-btn" onClick={nextMonth}>›</button>
      </div>

      {report && (
        <>
          {/* Карточки вместо таблицы: 6 колонок не помещались в ширину телефона
              и сдвигали весь экран вбок (21.10.2026). */}
          <div className="card recon-list">
            {visibleRows.length === 0 && <div className="empty-state">В этом месяце занятий и оплат нет</div>}
            {visibleRows.map((r) => (
              <div className="recon-row" key={r.trainerId}>
                <div className="recon-head">
                  <div className="recon-name">
                    <div className="balance-name">
                      {r.trainerName}
                      {r.mismatch && <span title="Расходится с данными центра"> ⚠️</span>}
                      {r.discountApplied && <span title="Применена скидка 10%"> 🏷️</span>}
                    </div>
                    <div className="balance-detail">{formatMoney(r.rate)} за занятие</div>
                  </div>
                  <div className={`balance-amount ${balanceColor(r.balance)}`}>{formatMoneySigned(r.balance)}</div>
                </div>
                <div className="recon-stats">
                  <span>План <b>{r.plan}</b></span>
                  <span>Оплачено <b>{r.paid}</b></span>
                  <span>Проведено <b>{r.completed}</b></span>
                </div>
                {r.carryIn !== 0 && (
                  <div className="recon-note">🔄 Перенос с прошлого месяца: {formatMoneySigned(r.carryIn)}</div>
                )}
                {r.overpayWarning && (
                  <div className="recon-note recon-warn">
                    Оплачено больше графика на {r.overpayWarning.extraSessions} зан. ({formatMoney(r.overpayWarning.extraAmount)})
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="card total-balance-card">
            <div className="label">Общий баланс за месяц</div>
            <div className="amount" style={{ color: `var(--${balanceColor(report.total)})` }}>
              {formatMoneySigned(report.total)}
            </div>
          </div>

          {report.missedBreakdown.length > 0 && (
            <>
              <div className="section-title">Пропуски по причинам</div>
              <div className="card">
                {report.missedBreakdown.map((m) => (
                  <div className="balance-row" key={m.status}>
                    <div className="balance-name">{m.label}</div>
                    <div>{m.count}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={exportExcel} disabled={exporting} style={{ marginTop: 8 }}>
            {exporting ? 'Экспорт…' : 'Экспорт отчёта (Excel)'}
          </button>

          <div className="section-title">Загрузить отчёт в формате PDF</div>
          <div className="hint-text">
            Печатная версия этой же сверки за месяц — с подробностями по дням и местом для подписи родителя и
            администрации центра. Удобно распечатать или переслать, если нужно показать расчёт центру. Файл
            пришлёт бот отдельным сообщением в этот чат — так его можно сохранить или переслать штатными
            средствами Telegram.
          </div>
          {pdfSent && (
            <div className="warning-box" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
              Готово — PDF отправлен ботом в чат выше.
            </div>
          )}
          <div className="lang-row">
            <button className="btn btn-outline" onClick={() => exportPdf('ru')} disabled={!!exportingPdf}>
              {exportingPdf === 'ru' ? '…' : '🇷🇺 Русский'}
            </button>
            <button className="btn btn-outline" onClick={() => exportPdf('uz')} disabled={!!exportingPdf}>
              {exportingPdf === 'uz' ? '…' : "🇺🇿 O'zbekcha"}
            </button>
            <button className="btn btn-outline" onClick={() => exportPdf('zh')} disabled={!!exportingPdf}>
              {exportingPdf === 'zh' ? '…' : '🇨🇳 中文'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
