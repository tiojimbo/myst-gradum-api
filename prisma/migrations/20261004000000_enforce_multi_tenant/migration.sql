BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "users" WHERE "organization_id" IS NULL) THEN
        RAISE EXCEPTION 'Existem usuários sem organização; associe-os antes de aplicar esta migração';
    END IF;
END
$$;

ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "users" DROP CONSTRAINT "users_singleton_key_check";
DROP INDEX "users_singleton_key_key";
ALTER TABLE "users" DROP COLUMN "singleton_key";

COMMIT;
