-- CreateTable
CREATE TABLE "AssistantConversationContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pendingAction" TEXT NOT NULL,
    "leadId" TEXT,
    "leadName" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversationContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversationContext_userId_key" ON "AssistantConversationContext"("userId");

-- CreateIndex
CREATE INDEX "AssistantConversationContext_expiresAt_idx" ON "AssistantConversationContext"("expiresAt");

-- AddForeignKey
ALTER TABLE "AssistantConversationContext" ADD CONSTRAINT "AssistantConversationContext_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
