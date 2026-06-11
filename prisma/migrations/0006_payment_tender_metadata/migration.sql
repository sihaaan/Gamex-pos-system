-- Optional per-payment metadata. For cash payments this records
-- { tenderedAmount, changeAmount } so change due is auditable while the
-- payment amount itself stays equal to the invoiced portion.
ALTER TABLE "payments" ADD COLUMN "metadata" JSONB;
