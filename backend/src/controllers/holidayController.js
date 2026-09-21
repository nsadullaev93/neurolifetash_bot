const HolidayModel = require('../models/Holiday');
const ClosedDayModel = require('../models/ClosedDay');

async function list(req, res, next) {
  try {
    res.json(await HolidayModel.listAll());
  } catch (err) {
    next(err);
  }
}

// «Центр работает?» из Mini App (ТЗ v2, §2.13) — то же самое решение,
// что и кнопки бота, только со стороны Настроек, если ответ ещё не дан там.
async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!['OPEN', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'status должен быть OPEN или CLOSED' });
    }

    const holiday = await HolidayModel.findById(req.params.id);
    if (!holiday) return res.status(404).json({ error: 'Праздник не найден' });

    await HolidayModel.setStatus(holiday.id, status);
    if (status === 'CLOSED') {
      await ClosedDayModel.createAndCancelSessions(holiday.date, holiday.title);
    }
    res.json(await HolidayModel.findById(holiday.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, setStatus };
