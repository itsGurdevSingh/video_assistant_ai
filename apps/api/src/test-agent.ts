import { HumanMessage, ToolMessage } from "@langchain/core/messages";

import {
  createMistralModel,
  createTimestampTool,
  createVideoAgentGraph,
} from "@video-assistant/ai";

import {
  createTranscriptRepository,
  createUserRepository,
  createVideoRepository,
  db,
} from "@video-assistant/db";

import { createTimestampRetrievalService } from "./services/timestamp-retrieval.service.js";

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  throw new Error("MISTRAL_API_KEY is not defined");
}

const userRepository = createUserRepository(db);
const videoRepository = createVideoRepository(db);
const transcriptRepository = createTranscriptRepository(db);

let userId: string | undefined;
let videoId: string | undefined;
let transcriptId: string | undefined;

try {
  /*
   * ======================================================
   * 1. CREATE TEST DATA
   * ======================================================
   */

  const user = await userRepository.create({
    name: "Agent Integration Test User",
  });

  userId = user.id;

  const video = await videoRepository.create({
    userId,
    sourceType: "upload",
    sourceUrl: undefined,
    title: "Agent Integration Test Video",
    durationSeconds: 120,
  });

  videoId = video.id;

  const transcript = await transcriptRepository.createWithSegments({
    transcript: {
      videoId,
      language: "en",
      model: "test",
      text: `
Rust is a systems programming language focused on memory safety and performance.

Rust provides memory safety without requiring a garbage collector.

The ownership system allows the compiler to verify memory usage at compile time.

PostgreSQL is a relational database with powerful SQL capabilities.

JavaScript is commonly used for building web applications and interactive user interfaces.
      `.trim(),
    },

    segments: [
      {
        segmentIndex: 0,
        startSeconds: 0,
        endSeconds: 20,
        text: "Rust is a systems programming language focused on memory safety and performance.",
      },
      {
        segmentIndex: 1,
        startSeconds: 20,
        endSeconds: 40,
        text: "Rust provides memory safety without requiring a garbage collector.",
      },
      {
        segmentIndex: 2,
        startSeconds: 40,
        endSeconds: 60,
        text: "The ownership system allows the compiler to verify memory usage at compile time.",
      },
      {
        segmentIndex: 3,
        startSeconds: 60,
        endSeconds: 80,
        text: "PostgreSQL is a relational database with powerful SQL capabilities.",
      },
      {
        segmentIndex: 4,
        startSeconds: 80,
        endSeconds: 120,
        text: "JavaScript is commonly used for building web applications and interactive user interfaces.",
      },
    ],
  });

  transcriptId = transcript.transcript.id;

  console.log("\nTest fixture created:");
  console.log(`User:       ${userId}`);
  console.log(`Video:      ${videoId}`);
  console.log(`Transcript: ${transcriptId}`);

  /*
   * ======================================================
   * 2. CREATE VIDEO-SCOPED TIMESTAMP RETRIEVER
   * ======================================================
   */

  const timestampRetriever = createTimestampRetrievalService({
    db,
    transcriptId,
  });

  /*
   * ======================================================
   * 3. CREATE TIMESTAMP TOOL
   * ======================================================
   */

  let timestampToolCalls = 0;

  const timestampTool = createTimestampTool({
    getSegments: async (timestampSeconds) => {
      timestampToolCalls++;

      console.log(`\n[TIMESTAMP TOOL] called at ${timestampSeconds}s`);

      const segments =
        await timestampRetriever.getSegments(timestampSeconds);

      console.log(
        `[TIMESTAMP TOOL] returned ${segments.length} segments`,
      );

      return segments;
    },
  });

  /*
   * ======================================================
   * 4. CREATE MODEL
   * ======================================================
   */

  const model = createMistralModel({
    apiKey,
    model: "open-mistral-nemo",
    temperature: 0,
  });

  /*
   * ======================================================
   * 5. CREATE AGENT
   *
   * semanticContext is intentionally NOT passed here.
   *
   * The graph is now reusable and receives semantic
   * context at invocation time.
   * ======================================================
   */

  const graph = createVideoAgentGraph({
    model,
    timestampTool,
  });

  /*
   * ======================================================
   * 6. TEST CONTEXT
   *
   * For this test we are still using manually supplied
   * context.
   *
   * The next step will replace this with real semantic
   * retrieval from TEI + pgvector.
   * ======================================================
   */

  const semanticContext = `
[0.00s - 20.00s] Rust is a systems programming language focused on memory safety and performance.

[20.00s - 40.00s] Rust provides memory safety without requiring a garbage collector.

[40.00s - 60.00s] The ownership system allows the compiler to verify memory usage at compile time.

[60.00s - 80.00s] PostgreSQL is a relational database with powerful SQL capabilities.

[80.00s - 120.00s] JavaScript is commonly used for building web applications and interactive user interfaces.
  `.trim();

  /*
   * ======================================================
   * 7. TEST HELPER
   * ======================================================
   */

  async function runTest(name: string, question: string) {
    timestampToolCalls = 0;

    console.log("\n========================================");
    console.log(name);
    console.log("========================================");
    console.log(`Question: ${question}`);

    const result = await graph.invoke(
      {
        messages: [new HumanMessage(question)],
      },
      {
        context: {
          semanticContext,
        },
      },
    );

    const toolMessages = result.messages.filter(
      (message) => message instanceof ToolMessage,
    );

    const finalMessage = result.messages[result.messages.length - 1];

    console.log(`\nTool calls executed: ${timestampToolCalls}`);
    console.log(`Tool messages: ${toolMessages.length}`);

    console.log("\nFinal answer:");
    console.log(finalMessage?.content);

    return {
      result,
      toolCalls: timestampToolCalls,
      toolMessages,
    };
  }

  /*
   * ======================================================
   * CASE 1
   *
   * Timestamp exists.
   * Model should call timestamp tool.
   * DB should return real segments.
   * ======================================================
   */

  const availableTimestamp = await runTest(
    "CASE 1 — Timestamp available",
    "What was explained around 30 seconds into the video?",
  );

  if (availableTimestamp.toolCalls === 0) {
    throw new Error("CASE 1 FAILED: timestamp tool was not called");
  }

  if (availableTimestamp.toolMessages.length === 0) {
    throw new Error("CASE 1 FAILED: no ToolMessage was produced");
  }

  console.log(
    "✓ CASE 1 PASSED: timestamp tool was called and returned data",
  );

  /*
   * ======================================================
   * CASE 2
   *
   * No timestamp question.
   * Model should answer using semantic context.
   * Timestamp tool must NOT be called.
   * ======================================================
   */

  const normalQuestion = await runTest(
    "CASE 2 — Timestamp tool not needed",
    "What is the main topic of this video?",
  );

  if (normalQuestion.toolCalls !== 0) {
    throw new Error("CASE 2 FAILED: timestamp tool was called");
  }

  if (normalQuestion.toolMessages.length !== 0) {
    throw new Error("CASE 2 FAILED: ToolMessage was produced");
  }

  console.log(
    "✓ CASE 2 PASSED: timestamp tool was not called",
  );

  /*
   * ======================================================
   * CASE 3
   *
   * Video is only 120 seconds.
   * User asks about 300 seconds.
   *
   * Model SHOULD call timestamp tool.
   * Database should return zero segments.
   * Model must not hallucinate.
   * ======================================================
   */

  const unavailableTimestamp = await runTest(
    "CASE 3 — Timestamp unavailable",
    "What was explained around 5 minutes into the video?",
  );

  if (unavailableTimestamp.toolCalls === 0) {
    throw new Error("CASE 3 FAILED: timestamp tool was not called");
  }

  if (unavailableTimestamp.toolMessages.length === 0) {
    throw new Error("CASE 3 FAILED: no ToolMessage was produced");
  }

  console.log(
    "✓ CASE 3 PASSED: timestamp tool was called for unavailable timestamp",
  );

  console.log("\n========================================");
  console.log("ALL AGENT TESTS PASSED");
  console.log("========================================");
} finally {
  /*
   * ======================================================
   * CLEANUP
   * ======================================================
   */

  if (userId) {
    await userRepository.delete(userId);
  }
}