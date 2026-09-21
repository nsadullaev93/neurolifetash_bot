const express = require('express');
const adminMiddleware = require('../middlewares/admin.middleware');
const { loginRateLimiter } = require('../middlewares/rateLimit.middleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.post('/login', loginRateLimiter, adminController.login);

router.use(adminMiddleware);

router.get('/dashboard', adminController.dashboard);

router.get('/levels', adminController.listLevels);
router.post('/levels', adminController.createLevel);
router.patch('/levels/:id', adminController.updateLevel);
router.delete('/levels/:id', adminController.deleteLevel);

router.get('/trainers', adminController.listTrainers);
router.post('/trainers', adminController.createTrainer);
router.patch('/trainers/:id', adminController.updateTrainer);
router.delete('/trainers/:id', adminController.deleteTrainer);

router.get('/schedule-slots', adminController.listSlots);
router.post('/schedule-slots', adminController.createSlot);
router.patch('/schedule-slots/:id', adminController.updateSlot);
router.delete('/schedule-slots/:id', adminController.deleteSlot);
router.post('/schedule-slots/apply-from-date', adminController.applyScheduleFromDate);

router.get('/sessions', adminController.listSessions);
router.post('/sessions', adminController.createSession);
router.patch('/sessions/bulk', adminController.bulkUpdateSessions);
router.patch('/sessions/:id', adminController.updateSession);
router.delete('/sessions/:id', adminController.deleteSession);

router.get('/payments', adminController.listPayments);
router.post('/payments', adminController.createPayment);
router.patch('/payments/:id', adminController.updatePayment);
router.delete('/payments/:id', adminController.deletePayment);

router.get('/closed-days', adminController.listClosedDays);
router.post('/closed-days', adminController.createClosedDay);
router.delete('/closed-days/:id', adminController.deleteClosedDay);

router.get('/users', adminController.listUsers);

router.post('/generate-month', adminController.generateMonthHandler);

router.get('/reports/monthly', adminController.monthlyReport);
router.get('/reports/forecast', adminController.forecastReport);
router.get('/reports/monthly/export', adminController.exportMonthlyReport);

module.exports = router;
