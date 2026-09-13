import {
  desc,
  eq,
  sql,
} from "drizzle-orm";

import type { Database } from "../client.js";
import {
  transcriptEmbeddings,
} from "../schema.js";

export type CreateTranscriptEmbeddingInput = {
  transcriptId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  startSeconds: number;
  endSeconds: number;
  embeddingModel: string;
};

export function createTranscriptEmbeddingRepository(
  db: Database,
) {
  return {
    async create(
      input: CreateTranscriptEmbeddingInput,
    ) {
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

    async createMany(
      input: CreateTranscriptEmbeddingInput[],
    ) {
      if (input.length === 0) {
        return [];
      }

      return db
        .insert(transcriptEmbeddings)
        .values(input)
        .returning();
    },

    async listByTranscript(
      transcriptId: string,
    ) {
      return db
        .select()
        .from(transcriptEmbeddings)
        .where(
          eq(
            transcriptEmbeddings.transcriptId,
            transcriptId,
          ),
        )
        .orderBy(
          transcriptEmbeddings.chunkIndex,
        );
    },

    async deleteByTranscript(
      transcriptId: string,
    ) {
      return db
        .delete(transcriptEmbeddings)
        .where(
          eq(
            transcriptEmbeddings.transcriptId,
            transcriptId,
          ),
        )
        .returning();
    },
  };
}