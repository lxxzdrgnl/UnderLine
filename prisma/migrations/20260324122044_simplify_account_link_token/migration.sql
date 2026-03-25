/*
  Warnings:

  - You are about to drop the column `codeVerifier` on the `AccountLinkToken` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `AccountLinkToken` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AccountLinkToken" DROP COLUMN "codeVerifier",
DROP COLUMN "provider";
