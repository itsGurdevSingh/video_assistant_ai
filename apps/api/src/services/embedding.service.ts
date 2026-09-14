import {
  createTranscriptEmbeddingRepository,
} from "@video-assistant/db";

import type {
  EmbeddingProvider,
} from "@video-assistant/ai";

export type CreateTranscriptEmbeddingsInput = {
  transcriptId: string;
  chunks: Array<{
    chunkIndex: number;
    displayText: string;
    embeddingText: string;
    startSeconds: number;
    endSeconds: number;
  }>;
  embeddingModel: string;
};

export function createEmbeddingService(
  db: Parameters<
    typeof createTranscriptEmbeddingRepository
  >[0],
  provider: EmbeddingProvider,
) {
  const repository =
    createTranscriptEmbeddingRepository(db);

  return {
    async createTranscriptEmbeddings(
      input: CreateTranscriptEmbeddingsInput,
    ) {
      if (input.chunks.length === 0) {
        throw new Error(
          "Cannot create embeddings without chunks",
        );
      }

      const orderedChunks = [...input.chunks].sort(
        (a, b) => a.chunkIndex - b.chunkIndex,
      );

      const embeddingTexts =
        orderedChunks.map(
          (chunk) => chunk.embeddingText,
        );

      const embeddings =
        await provider.embedMany(
          embeddingTexts,
        );

      if (
        embeddings.length !==
        orderedChunks.length
      ) {
        throw new Error(
          "Embedding provider returned an unexpected number of embeddings",
        );
      }

      for (const [index, embedding] of
        embeddings.entries()) {
        if (embedding.length !== 384) {
          throw new Error(
            `Expected embedding dimension 384, got ${embedding.length} at index ${index}`,
          );
        }
      }

      const rows = orderedChunks.map(
        (chunk, index) => {
          const embedding =
            embeddings[index];

          if (!embedding) {
            throw new Error(
              `Missing embedding for chunk ${chunk.chunkIndex}`,
            );
          }

          return {
            transcriptId: input.transcriptId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.displayText,
            embedding,
            startSeconds:
              chunk.startSeconds,
            endSeconds:
              chunk.endSeconds,
            embeddingModel:
              input.embeddingModel,
          };
        },
      );

      return repository.createMany(rows);
    },
  };
}