import { db } from "@video-assistant/db";

import { LocalStorage, WhisperCppProvider } from "@video-assistant/media";

import { TeiEmbeddingProvider } from "@video-assistant/ai";

import { createVideoService } from "./services/video.service.js";

import { createVideoProcessingService } from "./services/video-processing.service.js";

import { createRetrievalService } from "./services/retrieval.service.js";

import { createTimestampRetrievalService } from "./services/timestamp-retrieval.service.js";

import { createChatService } from "./services/chat.service.js";

import { createChatSessionService } from "./services/chat-session.service.js";

import { createChatMessageService } from "./services/chat-message.service.js";

import { createAuthService } from "./services/auth.service.js";

import { config } from "dotenv";

config({ path: "../../.env" });

export function createContainer() {
  /*
   * ============================================
   * Infrastructure
   * ============================================
   */

  const storage = new LocalStorage(process.env.MEDIA_STORAGE_PATH ?? "./data");

  const transcriptionProvider = new WhisperCppProvider({
    baseUrl: process.env.WHISPER_BASE_URL ?? "http://localhost:8080",
  });

  const embeddingProvider = new TeiEmbeddingProvider({
    baseUrl: process.env.EMBEDDINGS_BASE_URL ?? "http://localhost:8081",
  });

  /*
   * ============================================
   * Application services
   * ============================================
   */

  const videoService = createVideoService(db);

  const authService = createAuthService(db);

  const videoProcessingService = createVideoProcessingService({
    db,
    storage,
    transcriptionProvider,
    embeddingProvider,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "BAAI/bge-small-en-v1.5",
  });

  const retrievalService = createRetrievalService(db, embeddingProvider);

  const chatSessionService = createChatSessionService({
    db,
    videoService,
  });

  const chatMessageService = createChatMessageService({
    db,
    chatSessionService,
  });

  const createTimestampRetrieval = (transcriptId: string) =>
    createTimestampRetrievalService({
      db,
      transcriptId,
    });

  /*
   * ============================================
   * Base container
   * ============================================
   */

  const baseContainer = {
    db,
    storage,

    transcriptionProvider,
    embeddingProvider,

    videoService,
    authService,
    videoProcessingService,
    retrievalService,
    chatSessionService,
    chatMessageService,

    createTimestampRetrieval,
  };

  const chatService = createChatService({
    container: baseContainer,
    mistralApiKey: process.env.MISTRAL_API_KEY!,
  });

  return {
    ...baseContainer,
    chatService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
