import { createTranscriptRepository } from "@video-assistant/db";

export type CreateTimestampRetrievalInput = {
  transcriptId: string;
  windowSeconds?: number;
  db: Parameters<typeof createTranscriptRepository>[0]
};

const DEFAULT_WINDOW_SECONDS = 120;

export function createTimestampRetrievalService(
  input: CreateTimestampRetrievalInput,
) {
  const windowSeconds =
    input.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    throw new Error(
      "windowSeconds must be greater than zero",
    );
  }

  const transcriptRepository =
    createTranscriptRepository(input.db);

  const transcriptId = input.transcriptId;

  return {
    async getSegments(timestampSeconds: number) {

      if (!Number.isFinite(timestampSeconds)) {
        throw new Error(
          "timestampSeconds must be a finite number",
        );
      }

      if (timestampSeconds < 0) {
        throw new Error(
          "timestampSeconds cannot be negative",
        );
      }

      const startSeconds = Math.max(
        0,
        timestampSeconds - windowSeconds,
      );

      const endSeconds =
        timestampSeconds + windowSeconds;

      return transcriptRepository.listSegmentsByTime(
        transcriptId,
        startSeconds,
        endSeconds,
      );
    },
  };
}