import {
  createChatMessageRepository,
  type ChatMessageRole,
  type Database,
} from "@video-assistant/db";

import type { createChatSessionService } from "./chat-session.service.js";

export type ChatMessageServiceOptions = {
  db: Database;
  chatSessionService: ReturnType<typeof createChatSessionService>;
};

export function createChatMessageService(options: ChatMessageServiceOptions) {
  const repository = createChatMessageRepository(options.db);

  return {
    async appendMessage(input: {
      videoId: string;
      sessionId: string;
      role: ChatMessageRole;
      content: string;
    }) {
      const content = input.content.trim();

      if (!content) {
        throw new Error("Message content cannot be empty");
      }

      await options.chatSessionService.getSession({
        videoId: input.videoId,
        sessionId: input.sessionId,
      });

      const message = await repository.create({
        sessionId: input.sessionId,
        role: input.role,
        content,
      });

      await options.chatSessionService.touchSession(input.sessionId);

      return message;
    },

    async listMessages(input: { videoId: string; sessionId: string }) {
      await options.chatSessionService.getSession(input);

      return repository.listBySession(input.sessionId);
    },
  };
}
