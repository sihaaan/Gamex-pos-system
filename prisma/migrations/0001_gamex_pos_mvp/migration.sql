-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STAFF', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('POOL_TABLE', 'CONSOLE');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'PAUSED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TabStatus" AS ENUM ('OPEN', 'CLOSED', 'VOIDED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TimedLineStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED', 'CLOSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('STARTED', 'PAUSED', 'RESUMED', 'STOPPED', 'TRANSFERRED', 'CLOSED', 'MANUAL_ADJUSTED');

-- CreateEnum
CREATE TYPE "TenderType" AS ENUM ('CASH', 'UPI_GOOGLE_PAY', 'UPI_PHONEPE', 'UPI_OTHER', 'CARD_RECORDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('SALE', 'ADJUSTMENT', 'WASTAGE', 'REFUND');

-- CreateEnum
CREATE TYPE "TaxCodeKind" AS ENUM ('HSN', 'SAC');

-- CreateEnum
CREATE TYPE "JournalEntrySource" AS ENUM ('CHECKOUT', 'REFUND', 'CREDIT_NOTE', 'STOCK_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "JournalLineSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "SensitiveAction" AS ENUM ('VOID_TAB', 'VOID_INVOICE', 'HIGH_DISCOUNT', 'PRICE_OVERRIDE', 'RETROACTIVE_SESSION_EDIT', 'REFUND', 'CREDIT_NOTE', 'STOCK_ADJUSTMENT', 'REOPEN_CLOSED_TAB', 'REOPEN_OR_ADJUST_SHIFT', 'CHANGE_TAX_PRICING_CONFIG');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_envelope" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "idle_expires_at" TIMESTAMP(3) NOT NULL,
    "absolute_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_shifts" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "cash_opening_float" INTEGER,
    "cash_counted_amount" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_close_summaries" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "gross_sales" INTEGER NOT NULL,
    "discounts" INTEGER NOT NULL,
    "refunds" INTEGER NOT NULL,
    "voided_amount" INTEGER NOT NULL,
    "net_sales" INTEGER NOT NULL,
    "gst_collected" INTEGER NOT NULL,
    "cash_total" INTEGER NOT NULL,
    "upi_google_pay_total" INTEGER NOT NULL,
    "upi_phonepe_total" INTEGER NOT NULL,
    "upi_other_total" INTEGER NOT NULL,
    "card_recorded_total" INTEGER NOT NULL,
    "mixed_tender_total" INTEGER NOT NULL,
    "active_tab_count" INTEGER NOT NULL,
    "warnings" JSONB NOT NULL,
    "unusual_actions" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_close_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate_per_minute" INTEGER NOT NULL,
    "minimum_billable_minutes" INTEGER NOT NULL DEFAULT 1,
    "round_up_to_minutes" INTEGER NOT NULL DEFAULT 1,
    "manager_discount_limit_percent" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "TaxCodeKind" NOT NULL,
    "description" TEXT NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "tax_rate_id" TEXT NOT NULL,
    "pricing_rule_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sac_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_catalog" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "tax_rate_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsn_code" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "track_stock" BOOLEAN NOT NULL DEFAULT true,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabs" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "customer_label" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_gstin" TEXT,
    "status" "TabStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tab_timed_lines" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "service_catalog_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "status" "TimedLineStatus" NOT NULL DEFAULT 'RUNNING',
    "description_snapshot" TEXT NOT NULL,
    "sac_code_snapshot" TEXT NOT NULL,
    "gst_rate_snapshot" DECIMAL(5,2) NOT NULL,
    "rate_per_minute_snapshot" INTEGER NOT NULL,
    "minimum_billable_minutes_snapshot" INTEGER NOT NULL,
    "round_up_to_minutes_snapshot" INTEGER NOT NULL,
    "price_override_amount" INTEGER,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tab_timed_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_session_events" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "tab_timed_line_id" TEXT NOT NULL,
    "resource_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" "SessionEventType" NOT NULL,
    "metadata" JSONB NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_session_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tab_retail_lines" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "product_catalog_id" TEXT NOT NULL,
    "description_snapshot" TEXT NOT NULL,
    "hsn_code_snapshot" TEXT NOT NULL,
    "gst_rate_snapshot" DECIMAL(5,2) NOT NULL,
    "unit_price_snapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tab_retail_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "gst_invoice_id" TEXT,
    "tender_type" "TenderType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_series" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_invoices" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "invoice_series_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "legal_entity_name" TEXT NOT NULL,
    "legal_entity_gstin" TEXT NOT NULL,
    "legal_entity_address" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "branch_address" TEXT NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_gstin" TEXT,
    "taxable_value" INTEGER NOT NULL,
    "cgst_amount" INTEGER NOT NULL,
    "sgst_amount" INTEGER NOT NULL,
    "igst_amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_invoice_lines" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "gst_invoice_id" TEXT NOT NULL,
    "line_kind" TEXT NOT NULL,
    "source_line_id" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "taxable_value" INTEGER NOT NULL,
    "cgst_amount" INTEGER NOT NULL,
    "sgst_amount" INTEGER NOT NULL,
    "igst_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER,
    "billable_minutes" INTEGER,
    "pricing_rule_used" TEXT NOT NULL,
    "invoice_series_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "tab_id" TEXT NOT NULL,
    "gst_invoice_id" TEXT NOT NULL,
    "invoice_series_id" TEXT NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "taxable_value" INTEGER NOT NULL,
    "cgst_amount" INTEGER NOT NULL,
    "sgst_amount" INTEGER NOT NULL,
    "igst_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'POSTED',
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "original_line_id" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "taxable_value" INTEGER NOT NULL,
    "cgst_amount" INTEGER NOT NULL,
    "sgst_amount" INTEGER NOT NULL,
    "igst_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_payments" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT NOT NULL,
    "credit_note_id" TEXT NOT NULL,
    "tender_type" "TenderType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'POSTED',
    "refunded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_overrides" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT,
    "action" "SensitiveAction" NOT NULL,
    "status" "OverrideStatus" NOT NULL,
    "manager_user_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manager_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "operator_shift_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "before_json" JSONB,
    "after_json" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "operator_shift_id" TEXT,
    "product_catalog_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_accounts" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "source" "JournalEntrySource" NOT NULL,
    "source_id" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "legal_entity_id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "side" "JournalLineSide" NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_gstin_key" ON "legal_entities"("gstin");

-- CreateIndex
CREATE INDEX "branches_legal_entity_id_idx" ON "branches"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_legal_entity_id_code_key" ON "branches"("legal_entity_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_legal_entity_id_idx" ON "users"("legal_entity_id");

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_legal_entity_id_idx" ON "sessions"("legal_entity_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_legal_entity_id_role_permission_key" ON "role_permissions"("legal_entity_id", "role", "permission");

-- CreateIndex
CREATE INDEX "operator_shifts_legal_entity_id_branch_id_status_idx" ON "operator_shifts"("legal_entity_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "operator_shifts_staff_user_id_status_idx" ON "operator_shifts"("staff_user_id", "status");

-- CreateIndex
CREATE INDEX "shift_close_summaries_legal_entity_id_branch_id_generated_a_idx" ON "shift_close_summaries"("legal_entity_id", "branch_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "shift_close_summaries_operator_shift_id_version_key" ON "shift_close_summaries"("operator_shift_id", "version");

-- CreateIndex
CREATE INDEX "resources_legal_entity_id_branch_id_status_idx" ON "resources"("legal_entity_id", "branch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "resources_legal_entity_id_branch_id_name_key" ON "resources"("legal_entity_id", "branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_legal_entity_id_name_key" ON "pricing_rules"("legal_entity_id", "name");

-- CreateIndex
CREATE INDEX "tax_rates_legal_entity_id_code_effective_from_idx" ON "tax_rates"("legal_entity_id", "code", "effective_from");

-- CreateIndex
CREATE INDEX "service_catalog_legal_entity_id_idx" ON "service_catalog"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_legal_entity_id_branch_id_name_key" ON "service_catalog"("legal_entity_id", "branch_id", "name");

-- CreateIndex
CREATE INDEX "product_catalog_legal_entity_id_idx" ON "product_catalog"("legal_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_catalog_legal_entity_id_branch_id_sku_key" ON "product_catalog"("legal_entity_id", "branch_id", "sku");

-- CreateIndex
CREATE INDEX "tabs_legal_entity_id_branch_id_status_idx" ON "tabs"("legal_entity_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "tabs_operator_shift_id_idx" ON "tabs"("operator_shift_id");

-- CreateIndex
CREATE INDEX "tab_timed_lines_legal_entity_id_branch_id_status_idx" ON "tab_timed_lines"("legal_entity_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "tab_timed_lines_tab_id_idx" ON "tab_timed_lines"("tab_id");

-- CreateIndex
CREATE INDEX "service_session_events_legal_entity_id_branch_id_occurred_a_idx" ON "service_session_events"("legal_entity_id", "branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "service_session_events_tab_timed_line_id_occurred_at_idx" ON "service_session_events"("tab_timed_line_id", "occurred_at");

-- CreateIndex
CREATE INDEX "tab_retail_lines_legal_entity_id_branch_id_idx" ON "tab_retail_lines"("legal_entity_id", "branch_id");

-- CreateIndex
CREATE INDEX "tab_retail_lines_tab_id_idx" ON "tab_retail_lines"("tab_id");

-- CreateIndex
CREATE INDEX "payments_legal_entity_id_branch_id_received_at_idx" ON "payments"("legal_entity_id", "branch_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_operator_shift_id_tender_type_idx" ON "payments"("operator_shift_id", "tender_type");

-- CreateIndex
CREATE INDEX "invoice_series_legal_entity_id_branch_id_is_active_idx" ON "invoice_series"("legal_entity_id", "branch_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_series_legal_entity_id_branch_id_financial_year_pre_key" ON "invoice_series"("legal_entity_id", "branch_id", "financial_year", "prefix");

-- CreateIndex
CREATE UNIQUE INDEX "gst_invoices_tab_id_key" ON "gst_invoices"("tab_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_invoices_invoice_number_key" ON "gst_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "gst_invoices_legal_entity_id_branch_id_posted_at_idx" ON "gst_invoices"("legal_entity_id", "branch_id", "posted_at");

-- CreateIndex
CREATE INDEX "gst_invoice_lines_legal_entity_id_branch_id_idx" ON "gst_invoice_lines"("legal_entity_id", "branch_id");

-- CreateIndex
CREATE INDEX "gst_invoice_lines_gst_invoice_id_idx" ON "gst_invoice_lines"("gst_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_credit_note_number_key" ON "credit_notes"("credit_note_number");

-- CreateIndex
CREATE INDEX "credit_notes_legal_entity_id_branch_id_posted_at_idx" ON "credit_notes"("legal_entity_id", "branch_id", "posted_at");

-- CreateIndex
CREATE INDEX "credit_note_lines_legal_entity_id_branch_id_idx" ON "credit_note_lines"("legal_entity_id", "branch_id");

-- CreateIndex
CREATE INDEX "refund_payments_legal_entity_id_branch_id_refunded_at_idx" ON "refund_payments"("legal_entity_id", "branch_id", "refunded_at");

-- CreateIndex
CREATE INDEX "refund_payments_operator_shift_id_idx" ON "refund_payments"("operator_shift_id");

-- CreateIndex
CREATE INDEX "manager_overrides_legal_entity_id_branch_id_created_at_idx" ON "manager_overrides"("legal_entity_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_legal_entity_id_branch_id_created_at_idx" ON "audit_logs"("legal_entity_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_operator_shift_id_idx" ON "audit_logs"("operator_shift_id");

-- CreateIndex
CREATE INDEX "stock_movements_legal_entity_id_branch_id_created_at_idx" ON "stock_movements"("legal_entity_id", "branch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "journal_accounts_legal_entity_id_code_key" ON "journal_accounts"("legal_entity_id", "code");

-- CreateIndex
CREATE INDEX "journal_entries_legal_entity_id_branch_id_posted_at_idx" ON "journal_entries"("legal_entity_id", "branch_id", "posted_at");

-- CreateIndex
CREATE INDEX "journal_lines_legal_entity_id_journal_entry_id_idx" ON "journal_lines"("legal_entity_id", "journal_entry_id");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_shifts" ADD CONSTRAINT "operator_shifts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_shifts" ADD CONSTRAINT "operator_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_shifts" ADD CONSTRAINT "operator_shifts_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_close_summaries" ADD CONSTRAINT "shift_close_summaries_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog" ADD CONSTRAINT "service_catalog_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_catalog" ADD CONSTRAINT "product_catalog_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_catalog" ADD CONSTRAINT "product_catalog_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_catalog" ADD CONSTRAINT "product_catalog_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "service_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_timed_lines" ADD CONSTRAINT "tab_timed_lines_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_session_events" ADD CONSTRAINT "service_session_events_tab_timed_line_id_fkey" FOREIGN KEY ("tab_timed_line_id") REFERENCES "tab_timed_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_retail_lines" ADD CONSTRAINT "tab_retail_lines_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_retail_lines" ADD CONSTRAINT "tab_retail_lines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_retail_lines" ADD CONSTRAINT "tab_retail_lines_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_retail_lines" ADD CONSTRAINT "tab_retail_lines_product_catalog_id_fkey" FOREIGN KEY ("product_catalog_id") REFERENCES "product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tab_retail_lines" ADD CONSTRAINT "tab_retail_lines_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_gst_invoice_id_fkey" FOREIGN KEY ("gst_invoice_id") REFERENCES "gst_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoices" ADD CONSTRAINT "gst_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoices" ADD CONSTRAINT "gst_invoices_invoice_series_id_fkey" FOREIGN KEY ("invoice_series_id") REFERENCES "invoice_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoices" ADD CONSTRAINT "gst_invoices_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoices" ADD CONSTRAINT "gst_invoices_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoices" ADD CONSTRAINT "gst_invoices_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoice_lines" ADD CONSTRAINT "gst_invoice_lines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoice_lines" ADD CONSTRAINT "gst_invoice_lines_gst_invoice_id_fkey" FOREIGN KEY ("gst_invoice_id") REFERENCES "gst_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_invoice_lines" ADD CONSTRAINT "gst_invoice_lines_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_gst_invoice_id_fkey" FOREIGN KEY ("gst_invoice_id") REFERENCES "gst_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_series_id_fkey" FOREIGN KEY ("invoice_series_id") REFERENCES "invoice_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_overrides" ADD CONSTRAINT "manager_overrides_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_overrides" ADD CONSTRAINT "manager_overrides_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_overrides" ADD CONSTRAINT "manager_overrides_manager_user_id_fkey" FOREIGN KEY ("manager_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_overrides" ADD CONSTRAINT "manager_overrides_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_operator_shift_id_fkey" FOREIGN KEY ("operator_shift_id") REFERENCES "operator_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_catalog_id_fkey" FOREIGN KEY ("product_catalog_id") REFERENCES "product_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_accounts" ADD CONSTRAINT "journal_accounts_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "journal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_legal_entity_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
