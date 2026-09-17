import type { StructuredToolInterface } from "@langchain/core/tools";
import { SystemMessage } from "@langchain/core/messages";
import type { Runtime } from "@langchain/langgraph";

import type { ToolCallingChatModel } from "../models/chat-model.js";
import type { VideoAgentContext, VideoAgentState } from "./state.js";

export type VideoAgentNodeOptions = {
  model: ToolCallingChatModel;
  timestampTool: StructuredToolInterface;
};

export function createAgentNode(options: VideoAgentNodeOptions) {
  const modelWithTools = options.model.bindTools([options.timestampTool]);

  return async (
    state: typeof VideoAgentState.State,
    runtime: Runtime<VideoAgentContext>,
  ) => {
    const context = runtime.context;

    if (!context) {
      throw new Error("Video agent context is required");
    }

    const systemMessage = `
You are an AI assistant that answers questions about a video.

Use the provided transcript context to answer the user's question.

If the user asks about a specific timestamp or asks what was said or discussed at a particular time, use the get_transcript_at_timestamp tool.

Do not invent information that is not supported by the transcript.

Relevant transcript context:
${context.semanticContext}
`;

    const messages = [new SystemMessage(systemMessage), ...state.messages];

    const response = await modelWithTools.invoke(messages);

    return {
      messages: [response],
    };
  };
}
