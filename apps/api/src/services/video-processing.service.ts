import {
  createTranscriptRepository,
  createVideoRepository,
  type Database,
} from "@video-assistant/db";

import {
  chunkAudio,
  extractAudio,
} from "@video-assistant/media";

import type { EmbeddingProvider } from "@video-assistant/ai";

import {
  createTranscriptionService,
  type TranscriptionProvider,
} from "./transcription.service.js";

import {
  createEmbeddingService,
} from "./embedding.service.js";

import {
  chunkTranscript,
} from "@video-assistant/ai";

export type VideoProcessingStorage = {
  getPath(key: string): string;
  ensureDirectory(key: string): Promise<void>;
  deleteDirectory(key: string): Promise<void>;
};

export type VideoProcessingServiceOptions = {
  db: Database;
  storage: VideoProcessingStorage;
  transcriptionProvider: TranscriptionProvider;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
};

export function createVideoProcessingService(
  options: VideoProcessingServiceOptions,
) {
  const videoRepository =
    createVideoRepository(options.db);

  const transcriptionService =
    createTranscriptionService(
      options.db,
      options.transcriptionProvider,
    );

  const embeddingService =
    createEmbeddingService(
      options.db,
      options.embeddingProvider,
    );

  return {
    async processVideo(videoId: string) {
      const video =
        await videoRepository.findById(videoId);

      if (!video) {
        throw new Error(
          `Video not found: ${videoId}`,
        );
      }

      if (!video.storageKey) {
        throw new Error(
          `Video ${videoId} does not have a storage key`,
        );
      }

      const processingKey =
        `processing/${videoId}`;

      const audioKey =
        `${processingKey}/audio.wav`;

      const chunksKey =
        `${processingKey}/chunks`;

      const videoPath =
        options.storage.getPath(
          video.storageKey,
        );

      const audioPath =
        options.storage.getPath(
          audioKey,
        );

      const chunksDirectory =
        options.storage.getPath(
          chunksKey,
        );

      try {
        /*
         * ============================================
         * Prepare temporary processing directory
         * ============================================
         */

        await options.storage.ensureDirectory(
          processingKey,
        );

        /*
         * ============================================
         * 1. EXTRACT AUDIO
         * ============================================
         */

        await videoRepository.updateStatus(
          videoId,
          "extracting_audio",
        );

        await extractAudio(
          videoPath,
          audioPath,
        );

        /*
         * ============================================
         * 2. CHUNK AUDIO
         * ============================================
         */

        await videoRepository.updateStatus(
          videoId,
          "chunking",
        );

        const audioChunks =
          await chunkAudio(
            audioPath,
            chunksDirectory,
          );

        if (audioChunks.length === 0) {
          throw new Error(
            "Audio processing produced no chunks",
          );
        }

        /*
         * ============================================
         * 3. TRANSCRIBE + PERSIST
         * ============================================
         */

        await videoRepository.updateStatus(
          videoId,
          "transcribing",
        );

        const transcription =
          await transcriptionService
            .persistTranscription({
              videoId,
              language: "en",
              model: "whisper.cpp",
              chunks: audioChunks,
            });

        /*
         * ============================================
         * 4. CREATE RAG CHUNKS
         * ============================================
         */

        await videoRepository.updateStatus(
          videoId,
          "embedding",
        );

        const ragChunks =
          chunkTranscript(
            transcription.segments,
          );

        if (ragChunks.length === 0) {
          throw new Error(
            "Transcript produced no RAG chunks",
          );
        }

        /*
         * ============================================
         * 5. GENERATE + PERSIST EMBEDDINGS
         * ============================================
         */

        await embeddingService
          .createTranscriptEmbeddings({
            transcriptId:
              transcription.transcript.id,
            chunks: ragChunks,
            embeddingModel:
              options.embeddingModel,
          });

        /*
         * ============================================
         * 6. MARK READY
         * ============================================
         */

        await videoRepository.updateStatus(
          videoId,
          "ready",
        );

        return {
          videoId,
          transcriptId:
            transcription.transcript.id,
          ragChunkCount:
            ragChunks.length,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        await videoRepository
          .updateStatus(
            videoId,
            "failed",
            message,
          )
          .catch(() => {});

        throw error;
      } finally {
        /*
         * Temporary processing files are never
         * part of the permanent video storage.
         */

        await options.storage
          .deleteDirectory(
            processingKey,
          )
          .catch(() => {});
      }
    },
  };
}