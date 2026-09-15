import {
  createTranscriptEmbeddingRepository,
} from "@video-assistant/db";

import type {
  EmbeddingProvider,
} from "@video-assistant/ai";

export type SemanticSearchInput = {
  transcriptId: string;
  query: string;
  limit?: number;
};

export function createRetrievalService(
  db: Parameters<
    typeof createTranscriptEmbeddingRepository
  >[0],
  embeddingProvider: EmbeddingProvider,
) {
  const embeddingRepository =
    createTranscriptEmbeddingRepository(db);

  return {
    async semanticSearch(
      input: SemanticSearchInput,
    ) {
      const query = input.query.trim();

      if (!query) {
        throw new Error(
          "Search query cannot be empty",
        );
      }

      const embeddings =
        await embeddingProvider.embedMany([
          query,
        ]);

      const queryEmbedding =
        embeddings[0];

      if (!queryEmbedding) {
        throw new Error(
          "Failed to generate query embedding",
        );
      }

      return embeddingRepository.searchSimilar({
        transcriptId: input.transcriptId,
        embedding: queryEmbedding,
        limit: input.limit,
      });
    },
  };
}