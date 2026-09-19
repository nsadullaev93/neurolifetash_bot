const { Telegraf } = require('telegraf');
const config = require('../config/default');

if (!config.botToken) {
  throw new Error('BOT_TOKEN не задан в .env');
}

const bot = new Telegraf(config.botToken);

module.exports = bot;
