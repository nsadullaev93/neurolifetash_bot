-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessStatus" "AccessStatus" NOT NULL DEFAULT 'PENDING';

-- Grandfather in every user that already existed before access control was
-- introduced — only users created from this point on start out PENDING.
UPDATE "User" SET "accessStatus" = 'APPROVED';
