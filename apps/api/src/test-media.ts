import path from "node:path";
import { mkdir, rm } from "node:fs/promises";

import {
  db,
  createUserRepository,
  createVideoRepository,
  createTranscriptRepository,
} from "@video-assistant/db";

import {
  downloadYouTubeVideo,
  extractAudio,
  chunkAudio,
  WhisperCppProvider,
} from "@video-assistant/media";

import { createTranscriptionService } from "./services/transcription.service.js";

const youtubeUrl = process.argv.find(
  (arg) => arg.startsWith("https://") || arg.startsWith("http://"),
);

if (!youtubeUrl) {
  throw new Error(
    "Usage: pnpm exec tsx src/test-media.ts <youtube-url>",
  );
}

const root = path.resolve("tmp/media-test");

const videoDir = path.join(root, "videos");
const audioDir = path.join(root, "audio");
const chunksDir = path.join(root, "chunks");

const videoPath = path.join(
  videoDir,
  "test-video.mp4",
);

const audioPath = path.join(
  audioDir,
  "test-audio.wav",
);

console.log("========================================");
console.log("   VIDEO ASSISTANT INTEGRATION TEST");
console.log("========================================\n");

let testUserId: string | undefined;

try {
  // --------------------------------------------------
  // 1. Prepare directories
  // --------------------------------------------------

  console.log("[1/8] Preparing directories...");

  await mkdir(videoDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });
  await mkdir(chunksDir, { recursive: true });

  // --------------------------------------------------
  // 2. Create test user
  // --------------------------------------------------

  console.log("[2/8] Creating test user...");

  const userRepository = createUserRepository(db);

  const user = await userRepository.create({
    name: "Media Integration Test User",
  });

  testUserId = user.id;

  console.log(`Created user: ${user.id}\n`);

  // --------------------------------------------------
  // 3. Download YouTube video
  // --------------------------------------------------

  console.log("[3/8] Downloading YouTube video...");

  await downloadYouTubeVideo(
    youtubeUrl,
    videoPath,
  );

  console.log(`Video saved: ${videoPath}\n`);

  // --------------------------------------------------
  // 4. Create video record
  // --------------------------------------------------

  console.log("[4/8] Creating video record...");

  const videoRepository =
    createVideoRepository(db);

  const video = await videoRepository.create({
    userId: user.id,
    sourceType: "youtube",
    sourceUrl: youtubeUrl,
    title: "Media Integration Test",
  });

  console.log(`Created video: ${video.id}\n`);

  // --------------------------------------------------
  // 5. Extract + chunk audio
  // --------------------------------------------------

  console.log("[5/8] Extracting audio...");

  await extractAudio(
    videoPath,
    audioPath,
  );

  console.log(`Audio saved: ${audioPath}\n`);

  console.log("Chunking audio...");

  const chunks = await chunkAudio(
    audioPath,
    chunksDir,
    {
      chunkDurationSeconds: 300,
    },
  );

  console.log(
    `Created ${chunks.length} audio chunks:\n`,
  );

  for (const chunk of chunks) {
    console.log(
      `  Chunk ${chunk.index}: ` +
        `${chunk.startSeconds}s → ` +
        `${chunk.endSeconds}s`,
    );

    console.log(`  ${chunk.path}\n`);
  }

  // --------------------------------------------------
  // 6. Transcribe + persist
  // --------------------------------------------------

  console.log(
    "[6/8] Transcribing and persisting transcript...\n",
  );

  const whisper = new WhisperCppProvider({
    baseUrl: "http://localhost:8080",
  });

  const transcriptionService =
    createTranscriptionService(
      db,
      whisper,
    );

  const result =
    await transcriptionService.persistTranscription({
      videoId: video.id,
      language: "en",
      model: "whisper.cpp:base",
      chunks,
    });

  console.log(
    `Transcript created: ${result.transcript.id}`,
  );

  console.log(
    `Persisted ${result.segments.length} segments\n`,
  );

  // --------------------------------------------------
  // 7. Read back from PostgreSQL
  // --------------------------------------------------

  console.log(
    "[7/8] Verifying persisted data...\n",
  );

  const transcriptRepository =
    createTranscriptRepository(db);

  const savedTranscript =
    await transcriptRepository.findByVideoId(
      video.id,
    );

  if (!savedTranscript) {
    throw new Error(
      "Transcript was not found after persistence",
    );
  }

  console.log("Transcript retrieved successfully.");

  console.log(
    `Transcript ID: ${savedTranscript.id}`,
  );

  console.log(
    `Language: ${savedTranscript.language}`,
  );

  console.log(
    `Model: ${savedTranscript.model}`,
  );

  console.log(
    `Text length: ${savedTranscript.text.length}`,
  );

  const savedSegments =
    await transcriptRepository.listSegments(
      savedTranscript.id,
    );

  if (savedSegments.length === 0) {
    throw new Error(
      "No transcript segments were found",
    );
  }

  console.log(
    `Segments retrieved: ${savedSegments.length}\n`,
  );

  console.log("First 5 persisted segments:");

  for (
    const segment of savedSegments.slice(0, 5)
  ) {
    console.log(
      `  #${segment.segmentIndex} ` +
        `[${segment.startSeconds.toFixed(2)}s → ` +
        `${segment.endSeconds.toFixed(2)}s] ` +
        `${segment.text}`,
    );
  }

  // --------------------------------------------------
  // Verify timestamp range query
  // --------------------------------------------------

  const firstSegment = savedSegments[0];

  if (!firstSegment) {
    throw new Error(
      "Expected at least one transcript segment",
    );
  }

  const rangeStart =
    firstSegment.startSeconds;

  const rangeEnd =
    firstSegment.endSeconds + 10;

  const rangeSegments =
    await transcriptRepository.listSegmentsByTime(
      savedTranscript.id,
      rangeStart,
      rangeEnd,
    );

  console.log(
    `\nTime-range query: ` +
      `${rangeStart.toFixed(2)}s → ` +
      `${rangeEnd.toFixed(2)}s`,
  );

  console.log(
    `Matching segments: ${rangeSegments.length}`,
  );

  if (rangeSegments.length === 0) {
    throw new Error(
      "Time-range query returned no segments",
    );
  }

  for (const segment of rangeSegments) {
    console.log(
      `  [${segment.startSeconds.toFixed(2)}s → ` +
        `${segment.endSeconds.toFixed(2)}s] ` +
        segment.text,
    );
  }

  // --------------------------------------------------
  // Verification summary
  // --------------------------------------------------

  console.log("\n----------------------------------------");
  console.log("DATABASE VERIFICATION PASSED");
  console.log("----------------------------------------");

  console.log(`User ID:       ${user.id}`);
  console.log(`Video ID:      ${video.id}`);
  console.log(
    `Transcript ID: ${savedTranscript.id}`,
  );
  console.log(
    `Segments:      ${savedSegments.length}`,
  );
  console.log(
    `Time matches:  ${rangeSegments.length}`,
  );

  console.log(
    "\n========================================",
  );
  console.log(
    "       INTEGRATION TEST PASSED",
  );
  console.log(
    "========================================",
  );
} catch (error) {
  console.error("\n========================================");
  console.error("       INTEGRATION TEST FAILED");
  console.error("========================================\n");

  console.error(error);

  process.exitCode = 1;
} finally {
  // --------------------------------------------------
  // 8. Cleanup
  // --------------------------------------------------

  console.log("\nCleaning up test resources...");

  if (testUserId) {
    const userRepository =
      createUserRepository(db);

    const deletedUser =
      await userRepository.delete(
        testUserId,
      );

    if (deletedUser) {
      console.log(
        `Deleted test user: ${testUserId}`,
      );

      console.log(
        "Related video/transcript data " +
          "was removed by cascade.",
      );
    }
  }

  await rm(root, {
    recursive: true,
    force: true,
  });

  console.log("Removed temporary media files.");
}

