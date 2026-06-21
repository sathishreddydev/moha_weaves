ALTER TABLE "categories" ADD COLUMN "sort_order" integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on current alphabetical order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) - 1 as rn
  FROM categories
)
UPDATE categories SET sort_order = ordered.rn FROM ordered WHERE categories.id = ordered.id;
