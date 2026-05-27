ALTER TABLE "MsUser"
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

UPDATE "MsUser" AS u
SET "lastLoginAt" = latest."createdAt"
FROM (
  SELECT "userId", MAX("createdAt") AS "createdAt"
  FROM "TrSession"
  GROUP BY "userId"
) AS latest
WHERE latest."userId" = u."id"
  AND u."lastLoginAt" IS NULL;
