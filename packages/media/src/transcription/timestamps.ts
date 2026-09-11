import type { AudioChunk } from "../audio/chunker.js";
import type { TranscriptionSegment } from "./whisper-cpp.js";

export type TimestampedTranscriptionSegment =
  TranscriptionSegment & {
    startSeconds: number;
    endSeconds: number;
  };

export function applyChunkOffset(
  segments: TranscriptionSegment[],
  chunk: AudioChunk,
): TimestampedTranscriptionSegment[] {
  return segments.map((segment) => ({
    ...segment,
    startSeconds:
      segment.startSeconds + chunk.startSeconds,
    endSeconds:
      segment.endSeconds + chunk.startSeconds,
  }));
}