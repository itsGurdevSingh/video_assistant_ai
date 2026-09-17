import type { BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

export type ToolCallingChatModel = {
  invoke(
    messages: BaseMessage[],
  ): Promise<BaseMessage>;

  bindTools(
    tools: StructuredToolInterface[],
  ): {
    invoke(
      messages: BaseMessage[],
    ): Promise<BaseMessage>;
  };
};