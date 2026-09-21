import { useRef, useState } from 'react';
import { api } from '../api/client';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Backup() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState(null); // { file, backup } — предпросмотр перед подтверждением
  const [restoring, setRestoring] = useState(false);
  const fileInput = useRef(null);

  async function download() {
    setDownloading(true);
    setError('');
    try {
      const blob = await api.downloadBackup();
      const dateKey = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `backup_${dateKey}.json`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (backup.version !== 1) throw new Error('Неизвестный формат файла');
        setPending({ file, backup });
      } catch (err) {
        setError(`Не удалось прочитать файл: ${err.message}`);
      }
    };
    reader.onerror = () => setError('Не удалось прочитать файл');
    reader.readAsText(file);
  }

  async function confirmRestore() {
    if (!pending) return;
    setRestoring(true);
    setError('');
    try {
      const result = await api.restoreBackup(pending.backup);
      setSuccess(`Восстановлено: ${Object.entries(result).map(([k, v]) => `${k} — ${v}`).join(', ')}`);
      setPending(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  }

  const b = pending?.backup;

  return (
    <div>
      <div className="page-header"><h1>Резервная копия</h1></div>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}

      <div className="panel">
        <h2>Скачать бэкап</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
          То же самое, что бот присылает каждое воскресенье в 21:00 владельцу — полный снимок данных семьи в JSON,
          без токенов и паролей.
        </p>
        <button className="btn btn-primary" onClick={download} disabled={downloading}>
          {downloading ? 'Формируем…' : 'Скачать бэкап сейчас'}
        </button>
      </div>

      <div className="panel">
        <h2>Восстановить из файла</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
          Загрузите файл backup_*.json — каждая запись в нём восстановится по своему исходному id: удалённые записи
          вернутся, уже существующие обновятся до состояния из файла. Данные, отсутствующие в файле, не удаляются.
        </p>
        <input ref={fileInput} type="file" accept="application/json" onChange={onFileChosen} />

        {pending && (
          <div className="warning-box" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Предпросмотр файла «{pending.file.name}» (сформирован {b.exportedAt ? new Date(b.exportedAt).toLocaleString('ru-RU') : '—'}):
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Специалистов: {b.trainers?.length ?? 0}</li>
              <li>Занятий: {b.sessions?.length ?? 0}</li>
              <li>Оплат: {b.monthlyPayments?.length ?? 0}</li>
              <li>Расчётов (Settlement): {b.settlements?.length ?? 0}</li>
              <li>Заметок дневника: {b.sessionNotes?.length ?? 0}</li>
              <li>Участников семьи: {b.familyMembers?.length ?? 0}</li>
              <li>Праздников: {b.holidays?.length ?? 0}</li>
              <li>Закрытых дней: {b.closedDays?.length ?? 0}</li>
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-danger" onClick={confirmRestore} disabled={restoring}>
                {restoring ? 'Восстанавливаем…' : 'Подтвердить восстановление'}
              </button>
              <button className="btn btn-secondary" onClick={() => setPending(null)} disabled={restoring}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
