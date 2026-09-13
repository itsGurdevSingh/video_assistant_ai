import { TeiEmbeddingProvider } from "@video-assistant/ai";

const provider = new TeiEmbeddingProvider({
  baseUrl: "http://localhost:8081",
});

const texts = [
  "Rust is a systems programming language.",
  "TypeScript is a typed programming language.",
  "Vector databases are useful for semantic search.",
];

const embeddings = await provider.embedMany(texts);

console.log("Input count:", texts.length);
console.log("Embedding count:", embeddings.length);
console.log("Dimensions:", embeddings[0]?.length);
console.log("First vector:", embeddings[0]);