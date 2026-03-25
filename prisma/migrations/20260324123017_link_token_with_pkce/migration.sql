/*
  Warnings:

  - Added the required column `codeVerifier` to the `AccountLinkToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `AccountLinkToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccountLinkToken" ADD COLUMN     "codeVerifier" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL;
