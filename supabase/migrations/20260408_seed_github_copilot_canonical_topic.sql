-- Formalize GitHub Copilot as its own canonical narrow topic for the next
-- controlled expansion lane, and align the legacy copilot alias/content rows.

INSERT INTO fp_topic_taxonomy (
  slug,
  name,
  category,
  description,
  aliases,
  parent_id,
  status
)
VALUES (
  'github-copilot',
  'GitHub Copilot',
  'tool',
  'GitHub''s AI coding assistant and workflow surface for suggestions, chat, and coding operators.',
  jsonb_build_array('gh-copilot'),
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

UPDATE fp_topic_taxonomy
SET aliases = (
  SELECT COALESCE(
    (
      SELECT jsonb_agg(alias)
      FROM (
        SELECT DISTINCT alias
        FROM jsonb_array_elements_text(COALESCE(fp_topic_taxonomy.aliases, '[]'::jsonb)) AS alias
        WHERE alias <> 'github-copilot'
        ORDER BY alias
      ) deduped
    ),
    '[]'::jsonb
  )
)
WHERE slug = 'copilot'
  AND COALESCE(aliases, '[]'::jsonb) @> '["github-copilot"]'::jsonb;

UPDATE fp_content_lake
SET topics = (
  SELECT ARRAY(
    SELECT DISTINCT topic_slug
    FROM unnest(COALESCE(fp_content_lake.topics, ARRAY[]::text[]) || ARRAY['github-copilot']) AS topic_slug
  )
)
WHERE id = '4e6dbb45-d73b-4eb2-a60c-d254be9f1d4b';
