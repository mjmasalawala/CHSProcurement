-- CreateTable
CREATE TABLE "_CategoryToRequirement" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToRequirement_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CategoryToRequirement_B_index" ON "_CategoryToRequirement"("B");

-- AddForeignKey
ALTER TABLE "_CategoryToRequirement" ADD CONSTRAINT "_CategoryToRequirement_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToRequirement" ADD CONSTRAINT "_CategoryToRequirement_B_fkey" FOREIGN KEY ("B") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: carry each existing Requirement's single categoryId over into
-- the new join table before dropping the column, so no existing category
-- association is lost.
INSERT INTO "_CategoryToRequirement" ("A", "B")
SELECT "categoryId", "id" FROM "Requirement" WHERE "categoryId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Requirement" DROP CONSTRAINT "Requirement_categoryId_fkey";

-- AlterTable
ALTER TABLE "Requirement" DROP COLUMN "categoryId";
