import {
  createMistralModel,
  createTimestampTool,
  createVideoAgentGraph,
  formatSemanticContext,
} from "@video-assistant/ai";

import { createTranscriptRepository } from "@video-assistant/db";

import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { createVideoService } from "./video.service.js";

import { createRetrievalService } from "./retrieval.service.js";

import { createTimestampRetrievalService } from "./timestamp-retrieval.service.js";

import type { createChatSessionService } from "./chat-session.service.js";

import type { createChatMessageService } from "./chat-message.service.js";

export type ChatServiceDependencies = {
  db: Parameters<typeof createTranscriptRepository>[0];

  videoService: ReturnType<typeof createVideoService>;

  retrievalService: ReturnType<typeof createRetrievalService>;

  createTimestampRetrieval: (
    transcriptId: string,
  ) => ReturnType<typeof createTimestampRetrievalService>;

  chatSessionService: ReturnType<typeof createChatSessionService>;

  chatMessageService: ReturnType<typeof createChatMessageService>;
};

export type ChatServiceOptions = {
  container: ChatServiceDependencies;
  mistralApiKey: string;
};

export type ChatStreamEvent =
  | { type: "start"; sessionId: string; transcriptId: string }
  | { type: "token"; token: string }
  | { type: "complete"; answer: string; sources: unknown[] };

export function createChatService(options: ChatServiceOptions) {
  const { container } = options;

  const transcriptRepository = createTranscriptRepository(container.db);

  const model = createMistralModel({
    apiKey: options.mistralApiKey,
    model: process.env.MISTRAL_MODEL ?? "open-mistral-nemo",
    temperature: 0,
  });

  return {
    async askQuestion(input: {
      videoId: string;
      sessionId?: string;
      question: string;
    }) {
      const question = input.question.trim();

      if (!question) {
        throw new Error("Question cannot be empty");
      }

      const video = await container.videoService.findById(input.videoId);

      if (!video) {
        throw new Error(`Video not found: ${input.videoId}`);
      }

      if (video.status !== "ready") {
        throw new Error(
          `Video is not ready for chat. Current status: ${video.status}`,
        );
      }

      const transcript = await transcriptRepository.findByVideoId(
        input.videoId,
      );

      if (!transcript) {
        throw new Error(`Transcript not found for video: ${input.videoId}`);
      }

      const session = input.sessionId
        ? await container.chatSessionService.getSession({
            videoId: input.videoId,
            sessionId: input.sessionId,
          })
        : await container.chatSessionService.createSession({
            videoId: input.videoId,
          });

      const history = await container.chatMessageService.listMessages({
        videoId: input.videoId,
        sessionId: session.id,
      });

      const conversationMessages = history.map((message) =>
        message.role === "user"
          ? new HumanMessage(message.content)
          : new AIMessage(message.content),
      );

      await container.chatMessageService.appendMessage({
        videoId: input.videoId,
        sessionId: session.id,
        role: "user",
        content: question,
      });

      conversationMessages.push(new HumanMessage(question));

      /*
       * ============================================
       * Semantic retrieval
       * ============================================
       */

      const searchResults = await container.retrievalService.semanticSearch({
        transcriptId: transcript.id,
        query: question,
        limit: 5,
      });

      const semanticContext = formatSemanticContext(searchResults);

      /*
       * ============================================
       * Timestamp tool
       * ============================================
       */

      const timestampRetrieval = container.createTimestampRetrieval(
        transcript.id,
      );

      const timestampTool = createTimestampTool({
        getSegments: (timestampSeconds) =>
          timestampRetrieval.getSegments(timestampSeconds),
      });

      /*
       * ============================================
       * Agent
       * ============================================
       */

      const graph = createVideoAgentGraph({
        model,
        timestampTool,
      });

      const result = await graph.invoke(
        {
          messages: conversationMessages,
        },
        {
          context: {
            semanticContext,
          },
        },
      );

      const messages = result.messages;

      const lastMessage = messages[messages.length - 1];

      if (!lastMessage) {
        throw new Error("Agent returned no response");
      }

      const content = lastMessage.content;

      if (typeof content !== "string") {
        throw new Error("Agent returned non-text response");
      }

      await container.chatMessageService.appendMessage({
        videoId: input.videoId,
        sessionId: session.id,
        role: "assistant",
        content,
      });

      return {
        videoId: input.videoId,
        transcriptId: transcript.id,
        sessionId: session.id,
        question,
        answer: content,
        sources: searchResults,
      };
    },

    async *streamQuestion(input: {
      videoId: string;
      sessionId: string;
      question: string;
    }): AsyncGenerator<ChatStreamEvent> {
      const question = input.question.trim();

      if (!question) {
        throw new Error("Question cannot be empty");
      }

      const video = await container.videoService.findById(input.videoId);

      if (!video) {
        throw new Error(`Video not found: ${input.videoId}`);
      }

      if (video.status !== "ready") {
        throw new Error(
          `Video is not ready for chat. Current status: ${video.status}`,
        );
      }

      const transcript = await transcriptRepository.findByVideoId(
        input.videoId,
      );

      if (!transcript) {
        throw new Error(`Transcript not found for video: ${input.videoId}`);
      }

      const session = await container.chatSessionService.getSession({
        videoId: input.videoId,
        sessionId: input.sessionId,
      });

      const history = await container.chatMessageService.listMessages({
        videoId: input.videoId,
        sessionId: session.id,
      });

      const conversationMessages = history.map((message) =>
        message.role === "user"
          ? new HumanMessage(message.content)
          : new AIMessage(message.content),
      );

      await container.chatMessageService.appendMessage({
        videoId: input.videoId,
        sessionId: session.id,
        role: "user",
        content: question,
      });

      conversationMessages.push(new HumanMessage(question));

      const searchResults = await container.retrievalService.semanticSearch({
        transcriptId: transcript.id,
        query: question,
        limit: 5,
      });

      const timestampRetrieval = container.createTimestampRetrieval(
        transcript.id,
      );

      const timestampTool = createTimestampTool({
        getSegments: (timestampSeconds) =>
          timestampRetrieval.getSegments(timestampSeconds),
      });

      const graph = createVideoAgentGraph({
        model,
        timestampTool,
      });

      yield {
        type: "start",
        sessionId: session.id,
        transcriptId: transcript.id,
      };

      const eventStream = graph.streamEvents(
        {
          messages: conversationMessages,
        },
        {
          version: "v2",
          context: {
            semanticContext: formatSemanticContext(searchResults),
          },
        },
      );

      let answer = "";

      for await (const event of eventStream) {
        if (event.event !== "on_chat_model_stream") {
          continue;
        }

        const content = event.data.chunk?.content;

        if (typeof content !== "string" || !content) {
          continue;
        }

        answer += content;
        yield { type: "token", token: content };
      }

      if (!answer) {
        throw new Error("Agent returned no streamed response");
      }

      await container.chatMessageService.appendMessage({
        videoId: input.videoId,
        sessionId: session.id,
        role: "assistant",
        content: answer,
      });

      yield {
        type: "complete",
        answer,
        sources: searchResults,
      };
    },
  };
}
