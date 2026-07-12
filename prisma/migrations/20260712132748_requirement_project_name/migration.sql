-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "name" TEXT;

-- Backfill existing rows from description (truncated) since "name" is new
-- and has no natural source column.
UPDATE "Requirement" SET "name" = LEFT("description", 60) WHERE "name" IS NULL;

-- AlterTable
ALTER TABLE "Requirement" ALTER COLUMN "name" SET NOT NULL;
