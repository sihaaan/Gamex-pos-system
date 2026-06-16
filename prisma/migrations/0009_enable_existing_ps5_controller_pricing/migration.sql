UPDATE "pricing_rules" AS "pricing"
SET
  "controller_pricing_enabled" = true,
  "multiplayer_half_hour_price" = COALESCE("pricing"."multiplayer_half_hour_price", 6000),
  "multiplayer_hour_price" = COALESCE("pricing"."multiplayer_hour_price", 11000),
  "max_controllers" = GREATEST("pricing"."max_controllers", 4)
FROM "service_catalog" AS "service"
WHERE "service"."pricing_rule_id" = "pricing"."id"
  AND (
    lower("service"."name") LIKE '%ps5%'
    OR lower("service"."description") LIKE '%ps5%'
    OR lower("service"."description") LIKE '%console%'
  );
