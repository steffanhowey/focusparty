-- Add the missing canonical topics needed for the narrow readiness prototype slice
-- and formalize the exact existing content rows that already belong to them.

WITH claude_parent AS (
  SELECT id
  FROM fp_topic_taxonomy
  WHERE slug = 'claude'
  LIMIT 1
)
INSERT INTO fp_topic_taxonomy (
  slug,
  name,
  category,
  description,
  aliases,
  parent_id,
  status
)
VALUES
  (
    'claude-code',
    'Claude Code',
    'tool',
    'Anthropic''s coding-focused Claude workflow and product surface.',
    ARRAY['anthropic-claude-code']::text[],
    (SELECT id FROM claude_parent),
    'active'
  ),
  (
    'model-context-protocol',
    'Model Context Protocol',
    'concept',
    'A protocol for connecting models to external tools, context, and systems.',
    ARRAY['mcp']::text[],
    NULL,
    'active'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  aliases = EXCLUDED.aliases,
  parent_id = EXCLUDED.parent_id,
  status = EXCLUDED.status;

UPDATE fp_content_lake
SET topics = (
  SELECT ARRAY(
    SELECT DISTINCT topic_slug
    FROM unnest(COALESCE(fp_content_lake.topics, ARRAY[]::text[]) || ARRAY['claude-code']) AS topic_slug
  )
)
WHERE id IN (
  '596896bc-9c41-4548-b889-66571b55d212',
  '3a2e1ef2-a241-404d-9fa5-aaceb95a4046',
  '02160c57-4293-44f7-97fb-4d436bf9b883',
  '43762590-b430-4e75-bce3-78443035b004',
  '596d00dc-b06b-4b9a-938a-d2856cf9abe2',
  'b22543e0-9722-4ed6-8f49-7919a2045876'
);

UPDATE fp_content_lake
SET topics = (
  SELECT ARRAY(
    SELECT DISTINCT topic_slug
    FROM unnest(COALESCE(fp_content_lake.topics, ARRAY[]::text[]) || ARRAY['model-context-protocol']) AS topic_slug
  )
)
WHERE id IN (
  '60368efc-a51a-4fe2-964f-c00bf46d41cc'
);
