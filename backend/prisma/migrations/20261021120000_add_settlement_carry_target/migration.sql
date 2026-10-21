-- Позволяет перенаправить перенесённый остаток (Settlement.status =
-- CARRIED_OVER) другому специалисту, а не только тому же, у кого
-- образовалась переплата (доработка 21.10.2026 — специалист в отпуске не
-- может реально получить пользу от своего же перенесённого остатка).
-- NULL означает "тому же специалисту" (прежнее поведение).
ALTER TABLE "Settlement" ADD COLUMN "carriedToTrainerId" INTEGER;

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_carriedToTrainerId_fkey"
    FOREIGN KEY ("carriedToTrainerId") REFERENCES "Trainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
