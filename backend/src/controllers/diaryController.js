const SessionNoteModel = require('../models/SessionNote');
const SessionModel = require('../models/Session');
const { dateOnly } = require('../utils/date');
const { buildDiaryPdf } = require('../services/pdfDiary.service');
const { getChildName } = require('../utils/scope');

function serializeNote(note) {
  return {
    id: note.id,
    sessionId: note.sessionId,
    authorUserId: note.authorUserId,
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

// Писать и читать заметки могут все члены семьи — это не денежные данные
// (ТЗ v2, §2.15). Редактировать/удалять — только автор или владелец.
function canEdit(req, note) {
  return note.authorUserId === req.user.id || req.member?.role === 'OWNER';
}

async function listForSession(req, res, next) {
  try {
    const notes = await SessionNoteModel.listForSession(req.params.sessionId);
    res.json(notes.map(serializeNote));
  } catch (err) {
    next(err);
  }
}

async function createNote(req, res, next) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустая заметка' });

    const session = await SessionModel.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Занятие не найдено' });

    const created = await SessionNoteModel.create(session.id, req.user.id, text.trim());
    res.status(201).json(serializeNote(created));
  } catch (err) {
    next(err);
  }
}

async function updateNote(req, res, next) {
  try {
    const note = await SessionNoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
    if (!canEdit(req, note)) return res.status(403).json({ error: 'Редактировать может только автор или владелец' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустая заметка' });

    const updated = await SessionNoteModel.update(note.id, text.trim());
    res.json(serializeNote(updated));
  } catch (err) {
    next(err);
  }
}

async function removeNote(req, res, next) {
  try {
    const note = await SessionNoteModel.findById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
    if (!canEdit(req, note)) return res.status(403).json({ error: 'Удалить может только автор или владелец' });

    await SessionNoteModel.remove(note.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Дневник за период (ТЗ v2, §2.15) — лента заметок по датам, с
// необязательным фильтром по специалисту. from/to — 'YYYY-MM-DD'.
async function listPeriod(req, res, next) {
  try {
    const { from, to, trainerId } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Укажите from и to (YYYY-MM-DD)' });

    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const notes = await SessionNoteModel.listForPeriod(dateOnly(fy, fm, fd), dateOnly(ty, tm, td));

    const filtered = trainerId
      ? notes.filter((n) => {
          const trainer = n.session.actualTrainer || n.session.plannedTrainer;
          return trainer?.id === Number(trainerId);
        })
      : notes;

    res.json(
      filtered.map((n) => ({
        ...serializeNote(n),
        sessionDate: n.session.date,
        trainerName: (n.session.actualTrainer || n.session.plannedTrainer)?.name,
      })),
    );
  } catch (err) {
    next(err);
  }
}

async function exportPdf(req, res, next) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Укажите from и to (YYYY-MM-DD)' });

    const lang = req.query.lang === 'uz' ? 'uz' : 'ru';
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const childName = await getChildName();
    const buffer = await buildDiaryPdf(dateOnly(fy, fm, fd), dateOnly(ty, tm, td), lang, childName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="diary_${from}_${to}_${lang}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { listForSession, createNote, updateNote, removeNote, listPeriod, exportPdf };
