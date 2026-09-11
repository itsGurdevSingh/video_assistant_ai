import { and, eq, gt, lt } from "drizzle-orm";

import type { Database } from "../client.js";
import {
  transcripts,
  transcriptSegments,
} from "../schema.js";

export type CreateTranscriptInput = {
  videoId: string;
  language?: string;
  model?: string;
  text: string;
};

export type CreateTranscriptSegmentInput = {
  transcriptId: string;
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type CreateTranscriptWithSegmentsInput = {
  transcript: CreateTranscriptInput;
  segments: Omit<
    CreateTranscriptSegmentInput,
    "transcriptId"
  >[];
};

export function createTranscriptRepository(
  db: Database,
) {
  return {
    async create(input: CreateTranscriptInput) {
      const result = await db
        .insert(transcripts)
        .values(input)
        .returning();

      return result[0];
    },

    async createSegments(
      input: CreateTranscriptSegmentInput[],
    ) {
      if (input.length === 0) {
        return [];
      }

      return db
        .insert(transcriptSegments)
        .values(input)
        .returning();
    },

    async createWithSegments(
      input: CreateTranscriptWithSegmentsInput,
    ) {
      return db.transaction(async (tx) => {
        const transcriptResult = await tx
          .insert(transcripts)
          .values(input.transcript)
          .returning();

        const transcript = transcriptResult[0];

        if (!transcript) {
          throw new Error(
            "Failed to create transcript",
          );
        }

        const segmentInputs =
          input.segments.map((segment) => ({
            ...segment,
            transcriptId: transcript.id,
          }));

        const segments =
          segmentInputs.length > 0
            ? await tx
                .insert(transcriptSegments)
                .values(segmentInputs)
                .returning()
            : [];

        return {
          transcript,
          segments,
        };
      });
    },

    async findByVideoId(videoId: string) {
      const result = await db
        .select()
        .from(transcripts)
        .where(eq(transcripts.videoId, videoId))
        .limit(1);

      return result[0] ?? null;
    },

    async listSegments(transcriptId: string) {
      return db
        .select()
        .from(transcriptSegments)
        .where(
          eq(
            transcriptSegments.transcriptId,
            transcriptId,
          ),
        )
        .orderBy(transcriptSegments.segmentIndex);
    },

    async listSegmentsByTime(
      transcriptId: string,
      startSeconds: number,
      endSeconds: number,
    ) {
      if (startSeconds < 0) {
        throw new Error(
          "startSeconds must be greater than or equal to 0",
        );
      }

      if (endSeconds <= startSeconds) {
        throw new Error(
          "endSeconds must be greater than startSeconds",
        );
      }

      return db
        .select()
        .from(transcriptSegments)
        .where(
          and(
            eq(
              transcriptSegments.transcriptId,
              transcriptId,
            ),
            lt(
              transcriptSegments.startSeconds,
              endSeconds,
            ),
            gt(
              transcriptSegments.endSeconds,
              startSeconds,
            ),
          ),
        )
        .orderBy(transcriptSegments.segmentIndex);
    },
  };
}