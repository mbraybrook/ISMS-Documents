-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE INDEX IF NOT EXISTS "Note_documentId_idx" ON "Note"("documentId");

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE INDEX IF NOT EXISTS "Note_authorId_idx" ON "Note"("authorId");

-- AddForeignKey (idempotent - check if constraint exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Note_documentId_fkey'
    ) THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_documentId_fkey" 
            FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent - check if constraint exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Note_authorId_fkey'
    ) THEN
        ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" 
            FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

