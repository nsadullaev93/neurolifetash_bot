-- Пауза оплаты специалиста на период (отпуск и т.п., ТЗ-доработка
-- 02.10.2026): на эти дни "план по графику" для специалиста считается
-- нулевым, поэтому калькулятор оплаты и напоминание 1-7 числа не требуют
-- оплаты за этот период. Сами занятия в расписании/календаре не трогает.
CREATE TABLE "TrainerPause" (
    "id" SERIAL NOT NULL,
    "trainerId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerPause_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TrainerPause" ADD CONSTRAINT "TrainerPause_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
