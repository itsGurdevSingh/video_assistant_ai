import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

export const VideoAgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

export const VideoAgentContextSchema = z.object({
  semanticContext: z.string(),
});

export type VideoAgentContext = z.infer<typeof VideoAgentContextSchema>;