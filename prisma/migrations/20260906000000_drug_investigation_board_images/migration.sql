-- DI-9.5D: private investigation-board image metadata. Additive only —
-- no factual Drug Intelligence tables, DrugRelationship, network-group,
-- or merge schema changes. Bytes are not stored in JSON.

-- CreateTable
CREATE TABLE "DrugInvestigationBoardImage" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugInvestigationBoardImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugInvestigationBoardImage_boardId_idx" ON "DrugInvestigationBoardImage"("boardId");

-- CreateIndex
CREATE INDEX "DrugInvestigationBoardImage_boardId_createdAt_idx" ON "DrugInvestigationBoardImage"("boardId", "createdAt");

-- AddForeignKey
ALTER TABLE "DrugInvestigationBoardImage" ADD CONSTRAINT "DrugInvestigationBoardImage_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "DrugInvestigationBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
