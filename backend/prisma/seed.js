const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEVELS = [
  { code: 'BEGINNER', name: 'Начальный', rate: 230000 },
  { code: 'MIDDLE', name: 'Средний', rate: 277000 },
  { code: 'SENIOR', name: 'Старший', rate: 380000 },
];

// weekday: 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт
const TRAINERS = [
  {
    name: 'Усмон',
    levelCode: 'BEGINNER',
    slots: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '16:40', endTime: '17:20' })),
  },
  {
    name: 'Ли',
    levelCode: 'MIDDLE',
    slots: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '17:20', endTime: '18:00' })),
  },
  {
    name: 'Мисс Лю',
    levelCode: 'MIDDLE',
    slots: [2, 4].map((weekday) => ({ weekday, startTime: '16:00', endTime: '16:40' })),
  },
  {
    name: 'Лю Хеванг',
    levelCode: 'SENIOR',
    slots: [1, 3, 5].map((weekday) => ({ weekday, startTime: '16:00', endTime: '16:40' })),
  },
];

function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isoWeekday(d) {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

async function generateCurrentMonthSessions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const slots = await prisma.scheduleSlot.findMany({
    where: { isActive: true, trainer: { isActive: true } },
  });
  const closedDays = await prisma.closedDay.findMany();
  const closedSet = new Set(closedDays.map((c) => c.date.toISOString().slice(0, 10)));

  const total = daysInMonth(year, month);
  let created = 0;

  for (let day = 1; day <= total; day++) {
    const date = dateOnly(year, month, day);
    const weekday = isoWeekday(date);
    const isClosed = closedSet.has(date.toISOString().slice(0, 10));
    const slotsToday = slots.filter((s) => s.weekday === weekday);

    for (const slot of slotsToday) {
      const existing = await prisma.session.findUnique({
        where: {
          date_plannedTrainerId_startTime: {
            date,
            plannedTrainerId: slot.trainerId,
            startTime: slot.startTime,
          },
        },
      });
      if (existing) continue;

      await prisma.session.create({
        data: {
          date,
          year,
          month,
          startTime: slot.startTime,
          endTime: slot.endTime,
          plannedTrainerId: slot.trainerId,
          status: isClosed ? 'CLOSED_DAY' : 'PLANNED',
        },
      });
      created++;
    }
  }

  console.log(`Сгенерировано занятий на текущий месяц (${month}.${year}): ${created}`);
}

async function main() {
  console.log('Заполнение базы данных начальными данными...');

  const levelByCode = {};
  for (const level of LEVELS) {
    const saved = await prisma.level.upsert({
      where: { code: level.code },
      update: { name: level.name, rate: level.rate },
      create: level,
    });
    levelByCode[level.code] = saved;
  }
  console.log(`Уровни готовы: ${LEVELS.map((l) => l.name).join(', ')}`);

  for (const t of TRAINERS) {
    let trainer = await prisma.trainer.findFirst({ where: { name: t.name } });
    if (!trainer) {
      trainer = await prisma.trainer.create({
        data: { name: t.name, levelId: levelByCode[t.levelCode].id, isActive: true },
      });
      console.log(`Создан специалист: ${t.name}`);
    }

    for (const slot of t.slots) {
      await prisma.scheduleSlot.upsert({
        where: {
          trainerId_weekday_startTime: {
            trainerId: trainer.id,
            weekday: slot.weekday,
            startTime: slot.startTime,
          },
        },
        update: { endTime: slot.endTime, isActive: true },
        create: {
          trainerId: trainer.id,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: true,
        },
      });
    }
  }
  console.log('Расписание специалистов готово');

  await generateCurrentMonthSessions();

  console.log('Готово!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
