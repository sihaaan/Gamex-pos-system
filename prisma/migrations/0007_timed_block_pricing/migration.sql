ALTER TABLE "pricing_rules"
  ADD COLUMN "pricing_mode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
  ADD COLUMN "half_hour_price" INTEGER,
  ADD COLUMN "hour_price" INTEGER;

ALTER TABLE "tab_timed_lines"
  ADD COLUMN "pricing_mode_snapshot" TEXT NOT NULL DEFAULT 'PER_MINUTE',
  ADD COLUMN "half_hour_price_snapshot" INTEGER,
  ADD COLUMN "hour_price_snapshot" INTEGER;
