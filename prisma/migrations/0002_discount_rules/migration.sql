-- CreateTable
CREATE TABLE "discount_rules" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "minimum_billable_minutes" INTEGER NOT NULL DEFAULT 60,
    "days_of_week" INTEGER[] NOT NULL,
    "start_minute_of_day" INTEGER NOT NULL,
    "end_minute_of_day" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_rules_legal_entity_id_branch_id_is_active_idx" ON "discount_rules"("legal_entity_id", "branch_id", "is_active");

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
