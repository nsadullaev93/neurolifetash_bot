import { useState } from 'react';
import ReportReconciliation from './ReportReconciliation';
import ReportStats from './ReportStats';
import ReportDiary from './ReportDiary';

export default function Report({ canSeeMoney }) {
  const [subtab, setSubtab] = useState(canSeeMoney ? 'reconciliation' : 'stats');

  return (
    <div className="screen">
      <div className="header"><h1>Отчёт</h1></div>

      <div className="subtabs">
        {canSeeMoney && (
          <button className={`subtab ${subtab === 'reconciliation' ? 'active' : ''}`} onClick={() => setSubtab('reconciliation')}>
            Сверка
          </button>
        )}
        <button className={`subtab ${subtab === 'stats' ? 'active' : ''}`} onClick={() => setSubtab('stats')}>
          Статистика
        </button>
        <button className={`subtab ${subtab === 'diary' ? 'active' : ''}`} onClick={() => setSubtab('diary')}>
          Дневник
        </button>
      </div>

      {subtab === 'reconciliation' && canSeeMoney && <ReportReconciliation />}
      {subtab === 'stats' && <ReportStats canSeeMoney={canSeeMoney} />}
      {subtab === 'diary' && <ReportDiary />}
    </div>
  );
}
