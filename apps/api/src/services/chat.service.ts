import {
  createMistralModel,
  createTimestampTool,
  createVideoAgentGraph,
  formatSemanticContext,
} from "@video-assistant/ai";

import {
  createTranscriptRepository,
} from "@video-assistant/db";

import { HumanMessage } from "@langchain/core/messages";

import {
  createVideoService,
} from "./video.service.js";

import {
  createRetrievalService,
} from "./retrieval.service.js";

import {
  createTimestampRetrievalService,
} from "./timestamp-retrieval.service.js";

export type ChatServiceDependencies = {
  db: Parameters<
    typeof createTranscriptRepository
  >[0];

  videoService: ReturnType<
    typeof createVideoService
  >;

  retrievalService: ReturnType<
    typeof createRetrievalService
  >;

  createTimestampRetrieval: (
    transcriptId: string,
  ) => ReturnType<
    typeof createTimestampRetrievalService
  >;
};

export type ChatServiceOptions = {
  container: ChatServiceDependencies;
  mistralApiKey: string;
};

export function createChatService(
  options: ChatServiceOptions,
) {
  const {
    container,
  } = options;

  const transcriptRepository =
    createTranscriptRepository(
      container.db,
    );

  const model =
    createMistralModel({
      apiKey:
        options.mistralApiKey,
      model:
        process.env.MISTRAL_MODEL ??
        "open-mistral-nemo",
      temperature: 0,
    });

  return {
    async askQuestion(input: {
      videoId: string;
      question: string;
    }) {
      const question =
        input.question.trim();

      if (!question) {
        throw new Error(
          "Question cannot be empty",
        );
      }

      const video =
        await container.videoService.findById(
          input.videoId,
        );

      if (!video) {
        throw new Error(
          `Video not found: ${input.videoId}`,
        );
      }

      if (video.status !== "ready") {
        throw new Error(
          `Video is not ready for chat. Current status: ${video.status}`,
        );
      }

      const transcript =
        await transcriptRepository.findByVideoId(
          input.videoId,
        );

      if (!transcript) {
        throw new Error(
          `Transcript not found for video: ${input.videoId}`,
        );
      }

      /*
       * ============================================
       * Semantic retrieval
       * ============================================
       */

      const searchResults =
        await container.retrievalService.semanticSearch({
          transcriptId:
            transcript.id,
          query: question,
          limit: 5,
        });

      const semanticContext =
        formatSemanticContext(
          searchResults,
        );

      /*
       * ============================================
       * Timestamp tool
       * ============================================
       */

      const timestampRetrieval =
        container.createTimestampRetrieval(
          transcript.id,
        );

      const timestampTool =
        createTimestampTool({
          getSegments:
            (timestampSeconds) =>
              timestampRetrieval.getSegments(
                timestampSeconds,
              ),
        });

      /*
       * ============================================
       * Agent
       * ============================================
       */

      const graph =
        createVideoAgentGraph({
          model,
          timestampTool,
        });

      const result =
        await graph.invoke(
          {
            messages: [new HumanMessage(question)],
          },
          {
            context: {
              semanticContext,
            },
          },
        );

      const messages =
        result.messages;

      const lastMessage =
        messages[messages.length - 1];

      if (!lastMessage) {
        throw new Error(
          "Agent returned no response",
        );
      }

      const content =
        lastMessage.content;

      if (typeof content !== "string") {
        throw new Error(
          "Agent returned non-text response",
        );
      }

      return {
        videoId: input.videoId,
        transcriptId: transcript.id,
        question,
        answer: content,
        sources: searchResults,
      };
    },
  };
}