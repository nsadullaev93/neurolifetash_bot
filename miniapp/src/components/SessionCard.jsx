import { useState, useEffect } from 'react';
import { formatMoney } from '../utils/format';
import { api } from '../api/client';

const REASONS = [
  { status: 'TRAINER_ABSENT', label: 'Специалист отсутствовал' },
  { status: 'CHILD_SICK_CERT', label: 'Болезнь (справка есть)' },
  { status: 'CHILD_SICK_NO_CERT', label: 'Болезнь (справки нет)' },
  { status: 'CLOSED_DAY', label: 'Праздник' },
  { status: 'RESCHEDULED', label: 'Перенос' },
];

const NOT_DONE_STATUSES = [
  'TRAINER_ABSENT', 'CHILD_SICK_CERT', 'CHILD_SICK_NO_CERT', 'CHILD_ABSENT', 'CLOSED_DAY', 'RESCHEDULED',
];

export default function SessionCard({ session, trainers, onUpdate, busy }) {
  const [showReasons, setShowReasons] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!showNote) return;
    api.getSessionNotes(session.id).then(setNotes).catch(() => {});
  }, [showNote, session.id]);

  async function saveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const created = await api.createNote(session.id, noteText.trim());
      setNotes((list) => [...list, created]);
      setNoteText('');
    } catch {
      /* заметка не критична — молча не сохраняем при ошибке */
    } finally {
      setSavingNote(false);
    }
  }

  const isDone = session.isDone;
  const isNotDone = NOT_DONE_STATUSES.includes(session.status);
  const trainer = session.effectiveTrainer;
  const rate = trainer?.level?.rate;

  function markDone(done) {
    setShowReasons(false);
    onUpdate(session.id, { markDone: done });
  }

  function pickReason(status) {
    onUpdate(session.id, { status });
    setShowReasons(false);
  }

  function pickTrainer(e) {
    const value = e.target.value;
    onUpdate(session.id, { actualTrainerId: value === 'planned' ? null : Number(value) });
    setShowSwap(false);
  }

  return (
    <div className="card session-card">
      <div className="session-card-top">
        <div>
          <div className="session-time">{session.startTime}–{session.endTime}</div>
          <div className="session-trainer">
            {trainer?.name} · {trainer?.level?.name}
            {session.isSubstituted && ' (замена)'}
          </div>
          {rate !== undefined && <div className="session-rate">{formatMoney(rate)} за занятие</div>}
        </div>
        <span className={`status-pill ${isDone ? 'done' : isNotDone ? 'notdone' : 'planned'}`}>
          {session.statusLabel}
        </span>
      </div>

      <div className="toggle-row">
        <button
          className={`toggle-btn ${isDone ? 'active-done' : ''}`}
          disabled={busy}
          onClick={() => markDone(true)}
        >
          Было
        </button>
        <button
          className={`toggle-btn ${isNotDone ? 'active-notdone' : ''}`}
          disabled={busy}
          onClick={() => markDone(false)}
        >
          Не было
        </button>
      </div>

      {isNotDone && (
        <button className="link-btn" onClick={() => setShowReasons((v) => !v)}>
          {showReasons ? 'Скрыть причины' : 'Указать причину'}
        </button>
      )}

      {showReasons && (
        <div className="reason-grid">
          {REASONS.map((r) => (
            <button
              key={r.status}
              className={`reason-chip ${session.status === r.status ? 'active' : ''}`}
              onClick={() => pickReason(r.status)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {trainers && trainers.length > 1 && (
        <button className="link-btn" onClick={() => setShowSwap((v) => !v)}>
          {showSwap ? 'Скрыть' : 'Занятие провёл другой специалист'}
        </button>
      )}

      {showSwap && (
        <select
          className="form-select"
          defaultValue={session.actualTrainer ? session.actualTrainer.id : 'planned'}
          onChange={pickTrainer}
        >
          <option value="planned">По расписанию: {session.plannedTrainer?.name}</option>
          {trainers
            .filter((t) => t.id !== session.plannedTrainer?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
        </select>
      )}

      <button className="link-btn" onClick={() => setShowNote((v) => !v)}>
        📝 {showNote ? 'Скрыть заметки' : 'Заметка'}
      </button>

      {showNote && (
        <div>
          {notes.map((n) => (
            <div className="note-item" key={n.id}>
              <div className="note-text">{n.text}</div>
            </div>
          ))}
          <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Написать заметку…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={saveNote} disabled={savingNote || !noteText.trim()}>
            {savingNote ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      )}
    </div>
  );
}
