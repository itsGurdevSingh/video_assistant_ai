import {
  createChatSessionRepository,
  type Database,
} from "@video-assistant/db";

import type { createVideoService } from "./video.service.js";

export type ChatSessionServiceOptions = {
  db: Database;
  videoService: ReturnType<typeof createVideoService>;
};

export function createChatSessionService(options: ChatSessionServiceOptions) {
  const repository = createChatSessionRepository(options.db);

  async function ensureVideoExists(videoId: string) {
    const video = await options.videoService.findById(videoId);

    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    return video;
  }

  return {
    async createSession(input: {
      videoId: string;
      userId: string;
      title?: string;
    }) {
      const video = await ensureVideoExists(input.videoId);

      if (video.userId !== input.userId) {
        throw new Error(`Video not found: ${input.videoId}`);
      }

      return repository.create({
        videoId: input.videoId,
        title: input.title?.trim() || undefined,
      });
    },

    async getSession(input: {
      videoId: string;
      userId: string;
      sessionId: string;
    }) {
      const video = await ensureVideoExists(input.videoId);

      if (video.userId !== input.userId) {
        throw new Error(`Chat session not found: ${input.sessionId}`);
      }

      const session = await repository.findByIdForVideo(
        input.sessionId,
        input.videoId,
      );

      if (!session) {
        throw new Error(`Chat session not found: ${input.sessionId}`);
      }

      return session;
    },

    async listSessions(videoId: string, userId: string) {
      const video = await ensureVideoExists(videoId);

      if (video.userId !== userId) return [];

      return repository.listByVideo(videoId);
    },

    async touchSession(sessionId: string) {
      const session = await repository.touch(sessionId);

      if (!session) {
        throw new Error(`Chat session not found: ${sessionId}`);
      }

      return session;
    },
  };
}
