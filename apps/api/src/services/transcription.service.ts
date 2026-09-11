import {
  createTranscriptRepository,
  type CreateTranscriptInput,
} from "@video-assistant/db";

import type { AudioChunk, TranscriptionResult } from "@video-assistant/media";

export type TranscriptionProvider = {
  transcribe(audioPath: string): Promise<TranscriptionResult>;
};

export type PersistTranscriptionInput = {
  videoId: string;
  language?: string;
  model?: string;
  chunks: AudioChunk[];
};

export function createTranscriptionService(
  db: Parameters<typeof createTranscriptRepository>[0],
  provider: TranscriptionProvider,
) {
  const transcriptRepository = createTranscriptRepository(db);

  return {
    async persistTranscription(input: PersistTranscriptionInput) {
      if (input.chunks.length === 0) {
        throw new Error("Cannot persist transcription without audio chunks");
      }

      const orderedChunks = [...input.chunks].sort((a, b) => a.index - b.index);

      const results: Array<{
        chunk: AudioChunk;
        transcription: TranscriptionResult;
      }> = [];

      /*
       * Transcribe every audio chunk first.
       *
       * We intentionally do this outside the DB
       * transaction because transcription can take a
       * long time.
       */
      for (const chunk of orderedChunks) {
        const transcription = await provider.transcribe(chunk.path);

        results.push({
          chunk,
          transcription,
        });
      }

      /*
       * Build the complete transcript text in the
       * original chunk order.
       */
      const text = results
        .map(({ transcription }) => transcription.text.trim())
        .filter(Boolean)
        .join("\n\n");

      /*
       * Convert Whisper's chunk-local timestamps
       * into global video timestamps.
       */
      const segments = [];

      let segmentIndex = 0;

      for (const { chunk, transcription } of results) {
        for (const segment of transcription.segments) {
          const startSeconds = segment.startSeconds + chunk.startSeconds;

          const endSeconds = segment.endSeconds + chunk.startSeconds;

          const text = segment.text.trim();

          if (!text) {
            continue;
          }

          if (endSeconds <= startSeconds) {
            continue;
          }

          segments.push({
            segmentIndex,
            startSeconds,
            endSeconds,
            text,
          });

          segmentIndex++;
        }
      }

      if (segments.length === 0) {
        throw new Error("Transcription produced no segments");
      }

      const transcriptInput: CreateTranscriptInput = {
        videoId: input.videoId,
        language: input.language,
        model: input.model,
        text,
      };

      /*
       * Repository owns the transaction.
       *
       * Either transcript + all segments are persisted,
       * or nothing is persisted.
       */
      return transcriptRepository.createWithSegments({
        transcript: transcriptInput,
        segments,
      });
    },
  };
}
