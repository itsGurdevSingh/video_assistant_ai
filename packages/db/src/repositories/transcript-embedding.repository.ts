import { eq, sql } from "drizzle-orm";

import type { Database } from "../client.js";
import { transcriptEmbeddings } from "../schema.js";

export type SearchSimilarTranscriptEmbeddingsInput = {
  transcriptId: string;
  embedding: number[];
  limit?: number;
};

export type CreateTranscriptEmbeddingInput = {
  transcriptId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  startSeconds: number;
  endSeconds: number;
  embeddingModel: string;
};

export function createTranscriptEmbeddingRepository(db: Database) {
  return {
    async create(input: CreateTranscriptEmbeddingInput) {
      const result = await db
        .insert(transcriptEmbeddings)
        .values({
          transcriptId: input.transcriptId,
          chunkIndex: input.chunkIndex,
          text: input.text,
          embedding: input.embedding,
          startSeconds: input.startSeconds,
          endSeconds: input.endSeconds,
          embeddingModel: input.embeddingModel,
        })
        .returning();

      return result[0];
    },

    async createMany(input: CreateTranscriptEmbeddingInput[]) {
      if (input.length === 0) {
        return [];
      }

      return db.insert(transcriptEmbeddings).values(input).returning();
    },

    async listByTranscript(transcriptId: string) {
      return db
        .select()
        .from(transcriptEmbeddings)
        .where(eq(transcriptEmbeddings.transcriptId, transcriptId))
        .orderBy(transcriptEmbeddings.chunkIndex);
    },

    async deleteByTranscript(transcriptId: string) {
      return db
        .delete(transcriptEmbeddings)
        .where(eq(transcriptEmbeddings.transcriptId, transcriptId))
        .returning();
    },

    async searchSimilar(input: SearchSimilarTranscriptEmbeddingsInput) {
      const limit = input.limit ?? 5;

      if (input.embedding.length !== 384) {
        throw new Error(
          `Expected 384-dimensional query embedding, got ${input.embedding.length}`,
        );
      }

      if (limit <= 0) {
        throw new Error("Search limit must be greater than zero");
      }

      const queryEmbedding = `[${input.embedding.join(",")}]`;

      return db
        .select({
          id: transcriptEmbeddings.id,
          transcriptId: transcriptEmbeddings.transcriptId,
          chunkIndex: transcriptEmbeddings.chunkIndex,
          text: transcriptEmbeddings.text,
          startSeconds: transcriptEmbeddings.startSeconds,
          endSeconds: transcriptEmbeddings.endSeconds,
          embeddingModel: transcriptEmbeddings.embeddingModel,

          similarity: sql<number>`
        1 - (
          ${transcriptEmbeddings.embedding}
          <=> ${sql.raw(`'${queryEmbedding}'::vector`)}
        )
      `,
        })
        .from(transcriptEmbeddings)
        .where(eq(transcriptEmbeddings.transcriptId, input.transcriptId))
        .orderBy(
          sql`
        ${transcriptEmbeddings.embedding}
        <=> ${sql.raw(`'${queryEmbedding}'::vector`)}
      `,
        )
        .limit(limit);
    },
  };
}
