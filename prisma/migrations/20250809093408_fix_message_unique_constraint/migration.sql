/*
  Warnings:

  - A unique constraint covering the columns `[threadId,role,createdAt]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Message_threadId_content_role_key";

-- CreateIndex
CREATE UNIQUE INDEX "Message_threadId_role_createdAt_key" ON "public"."Message"("threadId", "role", "createdAt");
