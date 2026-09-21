const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEVELS = [
  { code: 'BEGINNER', name: 'Начальный', rate: 230000 },
  { code: 'MIDDLE', name: 'Средний', rate: 277000 },
  { code: 'SENIOR', name: 'Старший', rate: 380000 },
];

const TRAINER_COLORS = ['#E4572E', '#2E86AB', '#6A994E', '#9B5DE5', '#F4A261', '#3A86FF'];

// Праздники Узбекистана с фиксированной датой (ТЗ v2, §2.13). Даты Рамазан-
// и Курбан-хайита плавающие — добавляются вручную (Admin Panel / Настройки).
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, title: 'Новый год' },
  { month: 3, day: 8, title: 'Международный женский день' },
  { month: 3, day: 21, title: 'Навруз' },
  { month: 5, day: 9, title: 'День памяти и почестей' },
  { month: 9, day: 1, title: 'День Независимости' },
  { month: 10, day: 1, title: 'День учителя' },
  { month: 12, day: 8, title: 'День Конституции' },
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

// Схема рассчитана на несколько семей на будущее (ТЗ v2, §3), но
// регистрация новых не делается — сидируется всегда ровно одна Family
// и один Child (см. миграцию 20260921150000_add_family_v2).
async function ensureFamilyAndChild() {
  let family = await prisma.family.findFirst();
  if (!family) {
    family = await prisma.family.create({ data: { name: 'Семья' } });
    console.log('Создана семья');
  }

  let child = await prisma.child.findFirst({ where: { familyId: family.id } });
  if (!child) {
    child = await prisma.child.create({ data: { familyId: family.id, name: 'Ребёнок' } });
    console.log('Создан ребёнок');
  }

  return { family, child };
}

async function generateCurrentMonthSessions(childId) {
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
          childId_date_plannedTrainerId_startTime: {
            childId,
            date,
            plannedTrainerId: slot.trainerId,
            startTime: slot.startTime,
          },
        },
      });
      if (existing) continue;

      await prisma.session.create({
        data: {
          childId,
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

  const { family, child } = await ensureFamilyAndChild();

  const levelByCode = {};
  for (const level of LEVELS) {
    const saved = await prisma.level.upsert({
      where: { familyId_code: { familyId: family.id, code: level.code } },
      update: { name: level.name, rate: level.rate },
      create: { ...level, familyId: family.id },
    });
    levelByCode[level.code] = saved;
  }
  console.log(`Уровни готовы: ${LEVELS.map((l) => l.name).join(', ')}`);

  for (const [index, t] of TRAINERS.entries()) {
    let trainer = await prisma.trainer.findFirst({ where: { familyId: family.id, name: t.name } });
    if (!trainer) {
      trainer = await prisma.trainer.create({
        data: {
          familyId: family.id,
          name: t.name,
          levelId: levelByCode[t.levelCode].id,
          color: TRAINER_COLORS[index % TRAINER_COLORS.length],
          isActive: true,
        },
      });
      console.log(`Создан специалист: ${t.name}`);
    }

    for (const slot of t.slots) {
      await prisma.scheduleSlot.upsert({
        where: {
          trainerId_childId_weekday_startTime: {
            trainerId: trainer.id,
            childId: child.id,
            weekday: slot.weekday,
            startTime: slot.startTime,
          },
        },
        update: { endTime: slot.endTime, isActive: true },
        create: {
          trainerId: trainer.id,
          childId: child.id,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: true,
        },
      });
    }
  }
  console.log('Расписание специалистов готово');

  const thisYear = new Date().getFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    for (const h of FIXED_HOLIDAYS) {
      const date = dateOnly(year, h.month, h.day);
      await prisma.holiday.upsert({
        where: { familyId_date: { familyId: family.id, date } },
        update: { title: h.title },
        create: { familyId: family.id, date, title: h.title },
      });
    }
  }
  console.log(`Праздники-подсказки готовы на ${thisYear} и ${thisYear + 1} год`);

  await generateCurrentMonthSessions(child.id);

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
