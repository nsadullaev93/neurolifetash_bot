const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireMoneyAccess, requireOwnerRole } = require('../middlewares/auth.middleware');
const sessionController = require('../controllers/sessionController');
const paymentController = require('../controllers/paymentController');
const reportController = require('../controllers/reportController');
const familyController = require('../controllers/familyController');
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
    role: req.member?.role || null,
    canSeeMoney: !!req.member?.canSeeMoney,
    displayName: req.member?.displayName || req.user.firstName,
    theme: req.member?.theme || 'light',
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

router.get('/payments/history', requireMoneyAccess, paymentController.listHistory);
router.get('/payments', requireMoneyAccess, paymentController.listMonth);
router.post('/payments', requireOwnerRole, paymentController.create);
router.patch('/payments/:id', requireOwnerRole, paymentController.update);

router.get('/reports/monthly', requireMoneyAccess, reportController.monthly);
router.get('/reports/forecast', requireMoneyAccess, reportController.forecast);
router.get('/reports/payment-status', requireMoneyAccess, reportController.paymentStatus);
router.get('/reports/monthly/export', requireMoneyAccess, reportController.exportMonthly);

router.get('/family/members', familyController.listMembers);
router.post('/family/invite', requireOwnerRole, familyController.createInvite);
router.patch('/family/members/:id', requireOwnerRole, familyController.updateMember);
router.delete('/family/members/:id', requireOwnerRole, familyController.removeMember);

module.exports = router;
