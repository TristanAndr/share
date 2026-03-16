-- AlterTable: add expiresAt to Ban (nullable = permanent ban)
ALTER TABLE "Ban" ADD COLUMN "expiresAt" DATETIME;
