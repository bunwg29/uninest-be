export const UNACCENT_FUNCTION_SQL = `
  CREATE OR REPLACE FUNCTION uninest_unaccent(value text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, value) $$;
`;

export const KEYWORD_TRIGRAM_INDEXES_SQL = `
  CREATE INDEX IF NOT EXISTS "idx_listings_title_trgm"
    ON "listings" USING gin (uninest_unaccent("title") gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "idx_listings_full_address_trgm"
    ON "listings" USING gin (uninest_unaccent("full_address") gin_trgm_ops);
`;
