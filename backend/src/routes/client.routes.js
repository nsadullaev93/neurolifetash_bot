const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const sessionController = require('../controllers/sessionController');
const paymentController = require('../controllers/paymentController');
const reportController = require('../controllers/reportController');
const UserModel = require('../models/User');

const router = express.Router();

router.use(authMiddleware);

router.post('/auth/telegram', (req, res) => {
  res.json({
    id: req.user.id,
    telegramId: req.user.telegramId.toString(),
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    isAdmin: req.user.isAdmin,
    remindersOn: req.user.remindersOn,
    reminderTime: req.user.reminderTime,
  });
});

router.get('/settings', (req, res) => {
  res.json({ remindersOn: req.user.remindersOn, reminderTime: req.user.reminderTime });
});

router.patch('/settings', async (req, res, next) => {
  try {
    const { remindersOn, reminderTime } = req.body;
    const updated = await UserModel.updateReminderSettings(req.user.telegramId, { remindersOn, reminderTime });
    res.json({ remindersOn: updated.remindersOn, reminderTime: updated.reminderTime });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', sessionController.getDashboard);
router.get('/sessions/today', sessionController.getToday);
router.get('/sessions/unmarked', sessionController.getUnmarked);
router.get('/sessions', sessionController.getMonth);
router.patch('/sessions/:id', sessionController.updateSession);
router.post('/sessions/:id/makeup', sessionController.createMakeup);

router.get('/trainers', sessionController.listTrainers);

router.get('/payments/history', paymentController.listHistory);
router.get('/payments', paymentController.listMonth);
router.post('/payments', paymentController.create);
router.patch('/payments/:id', paymentController.update);

router.get('/reports/monthly', reportController.monthly);
router.get('/reports/forecast', reportController.forecast);
router.get('/reports/payment-status', reportController.paymentStatus);
router.get('/reports/monthly/export', reportController.exportMonthly);

module.exports = router;
