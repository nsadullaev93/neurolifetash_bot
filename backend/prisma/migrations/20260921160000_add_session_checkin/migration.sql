-- ТЗ v2, §7.1: ссылки на сообщения-чекины после занятий, отправленные
-- каждому получателю в чат — нужны, чтобы отредактировать все копии
-- сообщения, когда кто-то из членов семьи отвечает на любую из них.

CREATE TABLE "SessionCheckin" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionCheckin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionCheckin_sessionId_userId_key" ON "SessionCheckin"("sessionId", "userId");

ALTER TABLE "SessionCheckin" ADD CONSTRAINT "SessionCheckin_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
