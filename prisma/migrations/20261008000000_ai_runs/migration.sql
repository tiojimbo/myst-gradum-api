CREATE TYPE "AiEngine" AS ENUM ('GOAL', 'COMPETENCY', 'DIAGNOSTIC', 'FEASIBILITY', 'CURRICULUM', 'CONTENT', 'LEARNING', 'ASSESSMENT', 'VALIDATION', 'REVIEW_SUGGEST', 'ADAPTIVE');
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'INVALID', 'FAILED');
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "engine" "AiEngine" NOT NULL,
    "prompt_name" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_usd" DECIMAL(20,10),
    "latency_ms" INTEGER,
    "error" TEXT,
    "validation_errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_ai_runs_owner_engine_created" ON "ai_runs"("organization_id", "user_id", "engine", "created_at");
CREATE INDEX "idx_ai_runs_owner_status_deleted" ON "ai_runs"("organization_id", "user_id", "status", "deleted_at");
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_organization_id_fkey" FOREIGN KEY ("user_id", "organization_id") REFERENCES "users"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
