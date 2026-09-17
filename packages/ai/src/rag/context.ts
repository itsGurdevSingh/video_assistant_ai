export type SemanticSearchResult = {
  chunkIndex: number;
  text: string;
  similarity: number;
  startSeconds: number;
  endSeconds: number;
};

export function formatSemanticContext(
  results: SemanticSearchResult[],
): string {
  if (results.length === 0) {
    return "No relevant transcript context was found.";
  }

  return results
    .map(
      (result) =>
        `[${result.startSeconds.toFixed(2)}s - ${result.endSeconds.toFixed(2)}s] ${result.text}`,
    )
    .join("\n");
}