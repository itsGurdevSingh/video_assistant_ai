import { createTranscriptEmbeddingRepository, createTranscriptRepository } from "@video-assistant/db";

export type TimestampSearchInput = {
  transcriptId: string;
  timestampSeconds: number;
  windowSeconds?: number;
};

export function createTimestampRetrievalService(
    db: Parameters<
    typeof createTranscriptRepository
    >[0],
) {
    const embeddingRepository = createTranscriptRepository(db);

    return {
        async searchByTimestamp(
            input: TimestampSearchInput,
        ) {
            const windowSeconds = input.windowSeconds ?? 10;

            const startSeconds = input.timestampSeconds - windowSeconds/2;
            const endSeconds = input.timestampSeconds + windowSeconds/2;

            return embeddingRepository.listSegmentsByTime(
                input.transcriptId,
                startSeconds,
                endSeconds
            )
        }
    };
}