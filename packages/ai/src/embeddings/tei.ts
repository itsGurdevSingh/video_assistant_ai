import type { EmbeddingProvider } from "./provider.js";

export type TeiEmbeddingProviderOptions = {
  baseUrl?: string;
};

const EMBEDDING_DIMENSIONS = 384;

export class TeiEmbeddingProvider implements EmbeddingProvider {
  private readonly baseUrl: string;

  constructor(options: TeiEmbeddingProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:8081";
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    for (const [index, text] of texts.entries()) {
      if (!text.trim()) {
        throw new Error(
          `Cannot create embedding for empty text at index ${index}`,
        );
      }
    }

    const response = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: texts,
      }),
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `TEI embedding request failed (${response.status}): ${body}`,
      );
    }

    const raw: unknown = await response.json();

    return parseEmbeddings(raw);
  }
}

function parseEmbeddings(raw: unknown): number[][] {
  if (!Array.isArray(raw)) {
    throw new Error("TEI returned an invalid embedding response");
  }

  const embeddings: number[][] = [];

  for (const [index, embedding] of raw.entries()) {
    if (!Array.isArray(embedding)) {
      throw new Error(
        `TEI returned an invalid embedding at index ${index}`,
      );
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected embedding dimension ${EMBEDDING_DIMENSIONS}, ` +
          `got ${embedding.length} at index ${index}`,
      );
    }

    for (const [valueIndex, value] of embedding.entries()) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(
          `TEI returned an invalid vector value at ` +
            `embedding ${index}, position ${valueIndex}`,
        );
      }
    }

    embeddings.push(embedding);
  }

  return embeddings;
}