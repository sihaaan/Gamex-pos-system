ALTER TABLE "pricing_rules"
  ADD COLUMN "controller_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "multiplayer_half_hour_price" INTEGER,
  ADD COLUMN "multiplayer_hour_price" INTEGER,
  ADD COLUMN "max_controllers" INTEGER NOT NULL DEFAULT 4;

ALTER TABLE "tab_timed_lines"
  ADD COLUMN "controller_count_snapshot" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "controller_pricing_enabled_snapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "multiplayer_half_hour_price_snapshot" INTEGER,
  ADD COLUMN "multiplayer_hour_price_snapshot" INTEGER;
