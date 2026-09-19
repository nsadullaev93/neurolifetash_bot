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
