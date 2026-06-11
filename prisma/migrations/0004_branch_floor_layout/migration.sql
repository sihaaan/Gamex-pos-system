-- Add the floor map layout for each branch as a JSON document of
-- { width, height, items: [{ resourceId, x, y, w, h, rotation? }] }.
ALTER TABLE "branches" ADD COLUMN "floor_layout" JSONB;
