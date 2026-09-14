import { chunkTranscript } from "@video-assistant/ai";

const segments = [
  {
    segmentIndex: 0,
    startSeconds: 0,
    endSeconds: 12,
    text: "Today we're going to talk about Rust.",
  },
  {
    segmentIndex: 1,
    startSeconds: 12,
    endSeconds: 25,
    text: "Rust is a systems programming language.",
  },
  {
    segmentIndex: 2,
    startSeconds: 25,
    endSeconds: 39,
    text: "It focuses heavily on memory safety.",
  },
  {
    segmentIndex: 3,
    startSeconds: 39,
    endSeconds: 52,
    text: "It does this without requiring garbage collection.",
  },
  {
    segmentIndex: 4,
    startSeconds: 52,
    endSeconds: 67,
    text: "This makes Rust useful for systems programming.",
  },
];

const chunks = chunkTranscript(segments, {
  targetDurationSeconds: 60,
});

console.log(`Created ${chunks.length} RAG chunks\n`);

for (const chunk of chunks) {
  console.log(`Chunk ${chunk.chunkIndex}`);
  console.log(
    `Time: ${chunk.startSeconds}s → ${chunk.endSeconds}s`,
  );

  console.log(
    `Embedding text: ${chunk.embeddingText}`,
  );

  console.log(
    `Display text:\n${chunk.displayText}`,
  );

  console.log("----------------------------------------");
}