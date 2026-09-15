import {
  db,
  createUserRepository,
  createVideoRepository,
  createTranscriptRepository,
  createTranscriptEmbeddingRepository,
} from "@video-assistant/db";

import {
  TeiEmbeddingProvider,
} from "@video-assistant/ai";

const userRepository = createUserRepository(db);
const videoRepository = createVideoRepository(db);
const transcriptRepository = createTranscriptRepository(db);
const embeddingRepository =
  createTranscriptEmbeddingRepository(db);

const embeddingProvider =
  new TeiEmbeddingProvider({
    baseUrl: "http://localhost:8081",
  });

let userId: string | undefined;

try {
  console.log("========================================");
  console.log("       SIMILARITY SEARCH TEST");
  console.log("========================================\n");

  // ----------------------------------------
  // 1. Create test data
  // ----------------------------------------

  console.log("[1/5] Creating test user...");

  const user = await userRepository.create({
    name: "Similarity Search Test User",
  });

  userId = user.id;

  console.log(`User: ${user.id}\n`);

  console.log("[2/5] Creating test video...");

  const video = await videoRepository.create({
    userId: user.id,
    sourceType: "upload",
    sourceUrl: "test://similarity-search",
    title: "Similarity Search Test",
  });

  console.log(`Video: ${video.id}\n`);

  console.log("[3/5] Creating test transcript...");

  const transcript =
    await transcriptRepository.create({
      videoId: video.id,
      language: "en",
      model: "test",
      text:
        "Rust is a systems programming language focused on " +
        "memory safety and performance.\n\n" +
        "JavaScript is commonly used for building web " +
        "applications and interactive user interfaces.\n\n" +
        "PostgreSQL is a relational database with powerful " +
        "SQL capabilities.",
    });

  console.log(`Transcript: ${transcript.id}\n`);

  // ----------------------------------------
  // 2. Generate embeddings for known chunks
  // ----------------------------------------

  const chunks = [
    {
      chunkIndex: 0,
      text:
        "Rust is a systems programming language focused on " +
        "memory safety and performance.",
      startSeconds: 0,
      endSeconds: 20,
    },
    {
      chunkIndex: 1,
      text:
        "JavaScript is commonly used for building web " +
        "applications and interactive user interfaces.",
      startSeconds: 20,
      endSeconds: 40,
    },
    {
      chunkIndex: 2,
      text:
        "PostgreSQL is a relational database with powerful " +
        "SQL capabilities.",
      startSeconds: 40,
      endSeconds: 60,
    },
  ];

  console.log("Generating chunk embeddings...");

  const chunkEmbeddings =
    await embeddingProvider.embedMany(
      chunks.map((chunk) => chunk.text),
    );

  if (
    chunkEmbeddings.length !==
    chunks.length
  ) {
    throw new Error(
      `Expected ${chunks.length} embeddings, ` +
        `got ${chunkEmbeddings.length}`,
    );
  }

  await embeddingRepository.createMany(
    chunks.map((chunk, index) => {
      const embedding = chunkEmbeddings[index];

      if (!embedding) {
        throw new Error(
          `Missing embedding for chunk ${chunk.chunkIndex}`,
        );
      }

      return {
        transcriptId: transcript.id,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding,
        startSeconds: chunk.startSeconds,
        endSeconds: chunk.endSeconds,
        embeddingModel:
          "BAAI/bge-small-en-v1.5",
      };
    }),
  );

  console.log(
    `Persisted ${chunkEmbeddings.length} embeddings.\n`,
  );

  // ----------------------------------------
  // 3. Create semantic query
  // ----------------------------------------

  console.log(
    "[4/5] Generating query embedding...",
  );

  const query =
    "What programming language focuses on " +
    "memory safety and performance?";

  console.log(`Query: "${query}"\n`);

  const queryEmbeddings =
    await embeddingProvider.embedMany([
      query,
    ]);

  const queryEmbedding =
    queryEmbeddings[0];

  if (!queryEmbedding) {
    throw new Error(
      "Query embedding was not generated",
    );
  }

  // ----------------------------------------
  // 4. Similarity search
  // ----------------------------------------

  console.log(
    "Running cosine similarity search...\n",
  );

  const results =
    await embeddingRepository.searchSimilar({
      transcriptId: transcript.id,
      embedding: queryEmbedding,
      limit: 3,
    });

  // ----------------------------------------
  // 5. Verify results
  // ----------------------------------------

  console.log(
    "Similarity search results:\n",
  );

  for (const result of results) {
    console.log(
      `#${result.chunkIndex} ` +
        `similarity=${result.similarity.toFixed(4)} ` +
        `[${result.startSeconds}s → ` +
        `${result.endSeconds}s]`,
    );

    console.log(`  ${result.text}\n`);
  }

  if (results.length !== 3) {
    throw new Error(
      `Expected 3 results, got ${results.length}`,
    );
  }

  const firstResult = results[0];

  if (!firstResult) {
    throw new Error(
      "Similarity search returned no first result",
    );
  }

  if (firstResult.chunkIndex !== 0) {
    throw new Error(
      `Expected Rust chunk (#0) to rank first, ` +
        `got chunk #${firstResult.chunkIndex}`,
    );
  }

  if (
    firstResult.similarity <= 0 ||
    firstResult.similarity > 1
  ) {
    throw new Error(
      `Invalid similarity score: ` +
        `${firstResult.similarity}`,
    );
  }

  if (
    firstResult.startSeconds !== 0 ||
    firstResult.endSeconds !== 20
  ) {
    throw new Error(
      "First result returned incorrect timestamps",
    );
  }

  if (
    !firstResult.text.includes("memory safety")
  ) {
    throw new Error(
      "First result does not contain expected text",
    );
  }

  console.log(
    "----------------------------------------",
  );

  console.log(
    "SIMILARITY SEARCH TEST PASSED",
  );

  console.log(
    "----------------------------------------",
  );

  console.log(
    `Top result:       chunk #${firstResult.chunkIndex}`,
  );

  console.log(
    `Similarity:       ${firstResult.similarity.toFixed(4)}`,
  );

  console.log(
    `Timestamp:        ${firstResult.startSeconds}s → ` +
      `${firstResult.endSeconds}s`,
  );

  console.log(
    `Results returned: ${results.length}`,
  );
} catch (error) {
  console.error(
    "\n========================================",
  );

  console.error(
    "    SIMILARITY SEARCH TEST FAILED",
  );

  console.error(
    "========================================\n",
  );

  console.error(error);

  process.exitCode = 1;
} finally {
  console.log(
    "\nCleaning up test resources...",
  );

  if (userId) {
    const deletedUser =
      await userRepository.delete(userId);

    if (deletedUser) {
      console.log(
        `Deleted test user: ${userId}`,
      );

      console.log(
        "Related test data was removed by cascade.",
      );
    }
  }
}