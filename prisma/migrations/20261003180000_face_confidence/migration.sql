-- Plan 018c: identity scores move from "1 - distance" to a calibrated confidence:
--   confidence = 1 / (1 + exp((distance - 0.55) / 0.07)),  distance = 1 - old score.
-- Data only (no schema change). Applies to rows written by plan 018b.
UPDATE "IdentityCheck" SET "matchScore" = ROUND((1 / (1 + EXP(((1 - "matchScore") - 0.55) / 0.07)))::numeric, 3) WHERE "matchScore" IS NOT NULL;
UPDATE "ProctoringCheck" SET "matchScore" = ROUND((1 / (1 + EXP(((1 - "matchScore") - 0.55) / 0.07)))::numeric, 3) WHERE "matchScore" IS NOT NULL;
UPDATE "ProctoringFlag" SET "similarity" = ROUND((1 / (1 + EXP(((1 - "similarity") - 0.55) / 0.07)))::numeric, 3)
WHERE "similarity" IS NOT NULL AND "type" IN ('FACE_MISMATCH', 'IDENTITY_MISMATCH');
