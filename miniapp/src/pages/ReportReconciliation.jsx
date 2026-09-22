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
    try {
      const blob = await api.exportReportPdfBlob(year, month, lang);
      downloadBlob(blob, `sverka_${year}-${String(month).padStart(2, '0')}_${lang}.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingPdf('');
    }
  }

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
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Специалист</th>
                  <th>Ставка</th>
                  <th>Опл.</th>
                  <th>Пров.</th>
                  <th>Баланс</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.trainerId}>
                    <td>
                      {r.trainerName}
                      {r.mismatch && <span title="Расходится с данными центра"> ⚠️</span>}
                    </td>
                    <td>{formatMoney(r.rate)}</td>
                    <td>{r.paid}</td>
                    <td>{r.completed}</td>
                    <td className={`balance-amount ${balanceColor(r.balance)}`}>{formatMoneySigned(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.some((r) => r.overpayWarning) && (
              <div className="warning-box">
                {report.rows.filter((r) => r.overpayWarning).map((r) => (
                  <div key={r.trainerId}>
                    {r.trainerName}: оплачено {r.paid}, по графику {r.plan}. Переплата на {r.overpayWarning.extraSessions} занятий ({formatMoney(r.overpayWarning.extraAmount)}).
                  </div>
                ))}
              </div>
            )}
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
            администрации центра. Удобно распечатать или переслать, если нужно показать расчёт центру.
          </div>
          <div className="lang-row">
            <button className="btn btn-outline" onClick={() => exportPdf('ru')} disabled={!!exportingPdf}>
              {exportingPdf === 'ru' ? '…' : '🇷🇺 Русский'}
            </button>
            <button className="btn btn-outline" onClick={() => exportPdf('uz')} disabled={!!exportingPdf}>
              {exportingPdf === 'uz' ? '…' : "🇺🇿 O'zbekcha"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
