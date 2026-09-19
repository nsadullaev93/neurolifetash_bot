const express = require('express');
const bot = require('../core/bot');

const router = express.Router();

// Simple health-check endpoint. The bot itself runs via long polling
// (bot.launch() in src/index.js), no webhook is needed for localhost use.
router.get('/status', async (req, res, next) => {
  try {
    const me = await bot.telegram.getMe();
    res.json({ running: true, username: me.username });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
