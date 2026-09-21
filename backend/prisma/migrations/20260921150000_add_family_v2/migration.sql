-- ============================================================
-- ТЗ v2: семья/участники, привязка специалистов/расписания/занятий
-- к семье и ребёнку, праздники, перенос баланса, сверка с центром,
-- дневник занятий.
--
-- Однократный бэкфилл (см. DO $$ ... $$ ниже): создаётся ровно одна
-- Family и один Child, всё существующее привязывается к ним; каждый
-- APPROVED пользователь получает FamilyMember (isAdmin=true -> OWNER,
-- остальные -> MEMBER).
-- ============================================================

-- ---------- Новые enum'ы ----------
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "HolidayStatus" AS ENUM ('UNKNOWN', 'OPEN', 'CLOSED');
CREATE TYPE "SettlementStatus" AS ENUM ('OPEN', 'PAID_SEPARATELY', 'CARRIED_OVER', 'CLOSED');

-- ---------- Новые таблицы ----------

CREATE TABLE "Family" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Семья',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Child" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Ребёнок',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Child_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FamilyMember" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "displayName" TEXT NOT NULL,
    "canSeeMoney" BOOLEAN NOT NULL DEFAULT false,
    "sessionPings" BOOLEAN NOT NULL DEFAULT true,
    "paymentPings" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Holiday" (
    "id" SERIAL NOT NULL,
    "familyId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "status" "HolidayStatus" NOT NULL DEFAULT 'UNKNOWN',
    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Holiday_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Settlement" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "centerConducted" INTEGER,
    "agreedConducted" INTEGER,
    "status" "SettlementStatus" NOT NULL DEFAULT 'OPEN',
    "paidAmount" INTEGER,
    "paidAt" TIMESTAMP(3),
    "carriedToYear" INTEGER,
    "carriedToMonth" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Settlement_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SessionNote" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "authorUserId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------- Новые колонки на существующих таблицах (пока необязательные) ----------

ALTER TABLE "AuditLog" ADD COLUMN "familyId" INTEGER, ADD COLUMN "userId" INTEGER;
ALTER TABLE "ClosedDay" ADD COLUMN "familyId" INTEGER;
ALTER TABLE "Level" ADD COLUMN "familyId" INTEGER;
ALTER TABLE "MonthlyPayment" ADD COLUMN "enteredByUserId" INTEGER;
ALTER TABLE "ScheduleSlot" ADD COLUMN "childId" INTEGER;
ALTER TABLE "Session" ADD COLUMN "childId" INTEGER, ADD COLUMN "markedAt" TIMESTAMP(3), ADD COLUMN "markedByUserId" INTEGER;
ALTER TABLE "Trainer" ADD COLUMN "color" TEXT, ADD COLUMN "familyId" INTEGER;

-- ---------- Бэкфилл: одна Family, один Child, привязка всех существующих данных ----------

DO $$
DECLARE
  fam_id INTEGER;
  ch_id INTEGER;
  palette TEXT[] := ARRAY['#E4572E', '#2E86AB', '#6A994E', '#9B5DE5', '#F4A261', '#3A86FF'];
  r RECORD;
  i INTEGER := 0;
BEGIN
  INSERT INTO "Family" ("name") VALUES ('Семья') RETURNING id INTO fam_id;
  INSERT INTO "Child" ("familyId", "name") VALUES (fam_id, 'Ребёнок') RETURNING id INTO ch_id;

  UPDATE "AuditLog" SET "familyId" = fam_id WHERE "familyId" IS NULL;
  UPDATE "ClosedDay" SET "familyId" = fam_id WHERE "familyId" IS NULL;
  UPDATE "Level" SET "familyId" = fam_id WHERE "familyId" IS NULL;
  UPDATE "ScheduleSlot" SET "childId" = ch_id WHERE "childId" IS NULL;
  UPDATE "Session" SET "childId" = ch_id WHERE "childId" IS NULL;
  UPDATE "Trainer" SET "familyId" = fam_id WHERE "familyId" IS NULL;

  FOR r IN SELECT "id" FROM "Trainer" ORDER BY "id" ASC LOOP
    UPDATE "Trainer" SET "color" = palette[(i % array_length(palette, 1)) + 1] WHERE "id" = r."id";
    i := i + 1;
  END LOOP;

  -- Каждый уже одобренный пользователь получает участие в семье.
  -- isAdmin=true (первый, кто когда-то нажал /start) становится OWNER,
  -- остальные APPROVED — MEMBER без доступа к деньгам по умолчанию.
  INSERT INTO "FamilyMember" ("familyId", "userId", "role", "displayName", "canSeeMoney")
  SELECT
    fam_id,
    u."id",
    CASE WHEN u."isAdmin" THEN 'OWNER' ELSE 'MEMBER' END::"MemberRole",
    COALESCE(u."firstName", 'Участник'),
    u."isAdmin"
  FROM "User" u
  WHERE u."accessStatus" = 'APPROVED';
END $$;

-- ---------- Сделать обязательными теперь, когда всё заполнено ----------

ALTER TABLE "AuditLog" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "ClosedDay" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "Level" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "ScheduleSlot" ALTER COLUMN "childId" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "childId" SET NOT NULL;
ALTER TABLE "Trainer" ALTER COLUMN "familyId" SET NOT NULL;
ALTER TABLE "Trainer" ALTER COLUMN "color" SET NOT NULL;

-- ---------- Старые индексы, которые заменяются составными ----------

DROP INDEX "ClosedDay_date_key";
DROP INDEX "Level_code_key";
DROP INDEX "MonthlyPayment_year_month_trainerId_key";
DROP INDEX "ScheduleSlot_trainerId_weekday_startTime_key";
DROP INDEX "Session_date_plannedTrainerId_startTime_key";
DROP INDEX "Session_year_month_idx";

-- ---------- Новые индексы ----------

CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE UNIQUE INDEX "Holiday_familyId_date_key" ON "Holiday"("familyId", "date");
CREATE UNIQUE INDEX "Settlement_year_month_trainerId_key" ON "Settlement"("year", "month", "trainerId");
CREATE UNIQUE INDEX "ClosedDay_familyId_date_key" ON "ClosedDay"("familyId", "date");
CREATE UNIQUE INDEX "Level_familyId_code_key" ON "Level"("familyId", "code");
CREATE INDEX "MonthlyPayment_year_month_trainerId_idx" ON "MonthlyPayment"("year", "month", "trainerId");
CREATE UNIQUE INDEX "ScheduleSlot_trainerId_childId_weekday_startTime_key" ON "ScheduleSlot"("trainerId", "childId", "weekday", "startTime");
CREATE INDEX "Session_childId_year_month_idx" ON "Session"("childId", "year", "month");
CREATE UNIQUE INDEX "Session_childId_date_plannedTrainerId_startTime_key" ON "Session"("childId", "date", "plannedTrainerId", "startTime");

-- ---------- Внешние ключи для изменённых таблиц ----------

ALTER TABLE "ClosedDay" ADD CONSTRAINT "ClosedDay_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Level" ADD CONSTRAINT "Level_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trainer" ADD CONSTRAINT "Trainer_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
