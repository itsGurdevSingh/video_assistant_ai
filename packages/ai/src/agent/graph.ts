import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import {
  VideoAgentContextSchema,
  VideoAgentState,
} from "./state.js";
import { createAgentNode } from "./node.js";

export type VideoAgentOptions = Parameters<typeof createAgentNode>[0];

function shouldContinue(state: typeof VideoAgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];

  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  return END;
}

export function createVideoAgentGraph(options: VideoAgentOptions) {
  const agentNode = createAgentNode(options);
  const toolNode = new ToolNode([options.timestampTool]);

  const graph = new StateGraph(VideoAgentState, VideoAgentContextSchema)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return graph.compile();
}
