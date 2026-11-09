export const LISTING_EMBEDDING_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS "idx_listing_embeddings_embedding_hnsw"
    ON "listing_embeddings" USING hnsw ("embedding" vector_cosine_ops);
`;
