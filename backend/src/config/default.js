require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  botToken: process.env.BOT_TOKEN,
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  webAppUrl: process.env.WEBAPP_URL || 'http://localhost:5173',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:5174',
  timezone: process.env.TZ || 'Asia/Tashkent',
  allowDevLogin: (process.env.ALLOW_DEV_LOGIN || 'false').toLowerCase() === 'true',

  // Render задаёт RENDER_EXTERNAL_URL автоматически для веб-сервисов с публичным
  // адресом — вручную ничего настраивать не нужно. SELF_URL — запасной вариант
  // для другого хостинга. Если ни то ни другое не задано (например, локально),
  // self-ping просто не запускается.
  externalUrl: process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || null,
  selfPingEnabled: (process.env.SELF_PING_ENABLED || 'true').toLowerCase() === 'true',

  // Список разрешённых Telegram ID через запятую, например "111111111,222222222".
  // Свой ID можно узнать командой /myid у бота. Если переменная не задана —
  // доступ не ограничен (как было раньше) — заполните её, чтобы закрыть доступ
  // всем, кроме перечисленных людей.
  allowedTelegramIds: (process.env.ALLOWED_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),

  // Telegram ID владельца — получает запросы на доступ от новых пользователей
  // (кнопки «Разрешить» / «Отклонить») и не требует одобрения сам. Свой ID
  // можно узнать командой /myid у бота.
  ownerTelegramId: process.env.OWNER_TELEGRAM_ID || null,

  levels: {
    BEGINNER: { name: 'Начальный', rate: 230000 },
    MIDDLE: { name: 'Средний', rate: 277000 },
    SENIOR: { name: 'Старший', rate: 380000 },
  },

  statusLabels: {
    PLANNED: 'Запланировано',
    COMPLETED: 'Проведено',
    MAKEUP: 'Отработка',
    TRAINER_ABSENT: 'Специалист отсутствовал',
    CHILD_SICK_CERT: 'Ребёнок болел (справка есть)',
    CHILD_SICK_NO_CERT: 'Ребёнок болел (справки нет)',
    CHILD_ABSENT: 'Ребёнок отсутствовал',
    CLOSED_DAY: 'Праздник / центр закрыт',
    RESCHEDULED: 'Перенесено, ждёт отработки',
  },

  countsTowardCompleted: ['COMPLETED', 'MAKEUP'],

  weekdayNames: {
    1: 'Понедельник',
    2: 'Вторник',
    3: 'Среда',
    4: 'Четверг',
    5: 'Пятница',
    6: 'Суббота',
    7: 'Воскресенье',
  },
};
