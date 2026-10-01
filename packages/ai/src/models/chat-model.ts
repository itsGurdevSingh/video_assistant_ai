import type { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

export type ToolCallingChatModel = {
  invoke(messages: BaseMessage[]): Promise<BaseMessage>;

  stream(messages: BaseMessage[]): Promise<AsyncIterable<AIMessageChunk>>;

  bindTools(tools: StructuredToolInterface[]): {
    invoke(messages: BaseMessage[]): Promise<BaseMessage>;

    stream(messages: BaseMessage[]): Promise<AsyncIterable<AIMessageChunk>>;
  };
};
