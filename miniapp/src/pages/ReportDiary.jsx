import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { RU_MONTHS_NOM, formatDateRu } from '../utils/format';
import { downloadBlob } from '../utils/download';

const now = new Date();

function monthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function ReportDiary() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const { from, to } = monthRange(year, month);
      const list = await api.getDiary(from, to);
      setNotes(list);
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

  async function exportPdf(lang) {
    setExportingPdf(lang);
    try {
      const { from, to } = monthRange(year, month);
      const blob = await api.exportDiaryPdfBlob(from, to, lang);
      downloadBlob(blob, `diary_${from}_${to}_${lang}.pdf`);
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

      <div className="card">
        {notes.length === 0 ? (
          <div className="empty-state">Заметок за этот месяц нет</div>
        ) : (
          notes.map((n) => (
            <div className="note-item" key={n.id}>
              <div className="note-meta">{formatDateRu(n.sessionDate)} · {n.trainerName}</div>
              <div className="note-text">{n.text}</div>
            </div>
          ))
        )}
      </div>

      <div className="section-title">Выгрузить дневник в PDF</div>
      <div className="lang-row">
        <button className="btn btn-outline" onClick={() => exportPdf('ru')} disabled={!!exportingPdf}>
          {exportingPdf === 'ru' ? '…' : '🇷🇺 Русский'}
        </button>
        <button className="btn btn-outline" onClick={() => exportPdf('uz')} disabled={!!exportingPdf}>
          {exportingPdf === 'uz' ? '…' : "🇺🇿 O'zbekcha"}
        </button>
      </div>
    </>
  );
}
