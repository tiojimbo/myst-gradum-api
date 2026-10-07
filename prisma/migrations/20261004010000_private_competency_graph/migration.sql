CREATE TYPE "KnowledgeKind" AS ENUM ('FACTUAL', 'CONCEPTUAL', 'PROCEDURAL', 'SKILL', 'VISUAL', 'CREATIVE', 'TRANSFER', 'MOTOR');

CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain_slug" TEXT,
    "kind" "KnowledgeKind" NOT NULL,
    "target_level" INTEGER NOT NULL DEFAULT 3,
    "mastery_criterion" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skill_dependencies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "skill_dependencies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_not_self" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");
ALTER TABLE "skills" ADD CONSTRAINT "skills_target_level_range" CHECK ("target_level" BETWEEN 1 AND 5);
ALTER TABLE "skill_dependencies" ADD CONSTRAINT "skill_dependencies_not_self" CHECK ("skill_id" <> "prerequisite_id");

CREATE INDEX "skills_organization_id_user_id_parent_id_deleted_at_idx" ON "skills"("organization_id", "user_id", "parent_id", "deleted_at");
CREATE UNIQUE INDEX "skills_id_organization_id_user_id_key" ON "skills"("id", "organization_id", "user_id");
CREATE INDEX "skill_dependencies_organization_id_user_id_deleted_at_idx" ON "skill_dependencies"("organization_id", "user_id", "deleted_at");
CREATE UNIQUE INDEX "skill_dependencies_skill_id_prerequisite_id_key" ON "skill_dependencies"("skill_id", "prerequisite_id");
CREATE UNIQUE INDEX "users_id_organization_id_key" ON "users"("id", "organization_id");

ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skills" ADD CONSTRAINT "skills_parent_id_organization_id_user_id_fkey" FOREIGN KEY ("parent_id", "organization_id", "user_id") REFERENCES "skills"("id", "organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skill_dependencies" ADD CONSTRAINT "skill_dependencies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skill_dependencies" ADD CONSTRAINT "skill_dependencies_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skill_dependencies" ADD CONSTRAINT "skill_dependencies_skill_id_organization_id_user_id_fkey" FOREIGN KEY ("skill_id", "organization_id", "user_id") REFERENCES "skills"("id", "organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skill_dependencies" ADD CONSTRAINT "skill_dependencies_prerequisite_id_organization_id_user_id_fkey" FOREIGN KEY ("prerequisite_id", "organization_id", "user_id") REFERENCES "skills"("id", "organization_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
