/*
  Warnings:

  - You are about to drop the `AccountLinkToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "AccountLinkToken";

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL DEFAULT '/',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);
