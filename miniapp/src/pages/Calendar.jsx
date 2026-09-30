import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api/client';
import SessionCard from '../components/SessionCard';
import { cachedMonth, loadMonth } from '../utils/calendarData';
import { RU_MONTHS_NOM, RU_WEEKDAYS_SHORT, isoWeekday, dateKey } from '../utils/format';

const MISSED_STATUSES = ['TRAINER_ABSENT', 'CHILD_SICK_CERT', 'CHILD_SICK_NO_CERT', 'CHILD_ABSENT', 'RESCHEDULED'];

function dayColor(sessions, key, todayKey, isClosedHoliday) {
  if (sessions.length === 0) return isClosedHoliday ? 'purple' : 'gray';
  if (sessions.every((s) => s.status === 'CLOSED_DAY')) return isClosedHoliday ? 'purple' : 'gray';

  const relevant = sessions.filter((s) => s.status !== 'CLOSED_DAY');
  const hasPlanned = relevant.some((s) => s.status === 'PLANNED');
  const hasMissed = relevant.some((s) => MISSED_STATUSES.includes(s.status));

  if (key > todayKey) return 'white';
  if (hasPlanned) return 'yellow';
  if (hasMissed) return 'red';
  return 'green';
}

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  // уже загруженный месяц (в т. ч. подгруженный в фоне после входа) — сразу, свежие данные — поверх
  const monthKey = `${year}-${month}`;
  const currentKey = useRef(monthKey);
  currentKey.current = monthKey;
  const [data, setData] = useState(() => {
    const hit = cachedMonth(year, month);
    return hit ? { ...hit, monthKey } : null;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const key = `${year}-${month}`;
    try {
      setError('');
      const fresh = await loadMonth(year, month);
      if (currentKey.current === key) setData({ ...fresh, monthKey: key }); // пока грузились, месяц могли переключить
    } catch (err) {
      setError(err.message);
    }
  }, [year, month]);

  useEffect(() => {
    const hit = cachedMonth(year, month);
    setData(hit ? { ...hit, monthKey: `${year}-${month}` } : null);
    load();
  }, [load]);

  const loaded = data?.monthKey === monthKey;
  const sessions = loaded ? data.sessions : [];
  const trainers = data?.trainers || [];
  const closedHolidayKeys = loaded ? data.closedHolidayKeys : new Set();
  const todayKey = data?.todayKey || '';

  const sessionsByDay = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      const key = s.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [sessions]);

  function prevMonth() {
    setSelectedDay(null);
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    setSelectedDay(null);
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function handleUpdate(id, patch) {
    setBusyId(id);
    try {
      await api.updateSession(id, patch);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayKey = dateKey(year, month, 1);
  const leadingEmpty = isoWeekday(firstDayKey) - 1;

  const cells = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selectedDay ? dateKey(year, month, selectedDay) : null;
  const selectedSessions = selectedKey ? (sessionsByDay[selectedKey] || []) : [];

  return (
    <div className="screen">
      <div className="header"><h1>Календарь</h1></div>

      {error && <div className="error-box">{error}</div>}

      <div className="calendar-header">
        <button className="icon-btn" onClick={prevMonth}>‹</button>
        <h2>{RU_MONTHS_NOM[month - 1]} {year}</h2>
        <button className="icon-btn" onClick={nextMonth}>›</button>
      </div>

      {/* сетка — сразу; пока нет данных месяца, она бледная (а не «серая — выходной») */}
      <div className={loaded ? 'calendar-grid' : 'calendar-grid loading'}>
        {RU_WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="calendar-weekday">{w}</div>
        ))}
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="calendar-day empty" />;
          const key = dateKey(year, month, d);
          const daySessions = sessionsByDay[key] || [];
          const color = dayColor(daySessions, key, todayKey, closedHolidayKeys.has(key));
          return (
            <button
              key={key}
              className={`calendar-day day-${color} ${selectedDay === d ? 'selected' : ''}`}
              onClick={() => setSelectedDay(selectedDay === d ? null : d)}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--green)' }} /> Всё проведено</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--red)' }} /> Есть пропуски</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--yellow)' }} /> Не отмечено</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--gray)' }} /> Выходной / закрыто</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--purple)' }} /> Праздник</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#fff', border: '1px solid var(--border)' }} /> Будущее</div>
      </div>

      {selectedDay && (
        <>
          <div className="section-title">{selectedDay} {RU_MONTHS_NOM[month - 1].toLowerCase()}</div>
          {!loaded ? (
            <div className="empty-state">Загрузка…</div>
          ) : selectedSessions.length === 0 ? (
            <div className="empty-state">Занятий в этот день нет</div>
          ) : (
            selectedSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                trainers={trainers}
                onUpdate={handleUpdate}
                busy={busyId === s.id}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
