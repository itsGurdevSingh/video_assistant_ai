import { tool } from "@langchain/core/tools";
import { z } from "zod";

export type TimestampSegment = {
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TimestampToolOptions = {
  getSegments: (
    timestampSeconds: number,
  ) => Promise<TimestampSegment[]>;
};

export function createTimestampTool(
  options: TimestampToolOptions,
) {
  return tool(
    async ({ timestampSeconds }) => {
      const segments = await options.getSegments(
        timestampSeconds,
      );

      if (segments.length === 0) {
        return `No transcript was found around ${timestampSeconds} seconds.`;
      }

      return segments
        .map(
          (segment) =>
            `[${segment.startSeconds.toFixed(2)}s - ${segment.endSeconds.toFixed(2)}s] ${segment.text.trim()}`,
        )
        .join("\n");
    },
    {
      name: "get_transcript_at_timestamp",
      description:
        "Get transcript segments around a specific timestamp in the current video. Use this when the user asks what was said, discussed, or explained at a particular time.",
      schema: z.object({
        timestampSeconds: z
          .number()
          .min(0)
          .describe(
            "The timestamp in seconds in the current video.",
          ),
      }),
    },
  );
}