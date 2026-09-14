export type RagChunkInputSegment = {
  segmentIndex: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export type RagChunk = {
  chunkIndex: number;
  embeddingText: string;
  displayText: string;
  startSeconds: number;
  endSeconds: number;
};

export type RagChunkerOptions = {
  targetDurationSeconds?: number;
};

const DEFAULT_TARGET_DURATION_SECONDS = 60;

export function chunkTranscript(
  segments: RagChunkInputSegment[],
  options: RagChunkerOptions = {},
): RagChunk[] {
  if (segments.length === 0) {
    return [];
  }

  const targetDuration =
    options.targetDurationSeconds ??
    DEFAULT_TARGET_DURATION_SECONDS;

  if (targetDuration <= 0) {
    throw new Error(
      "targetDurationSeconds must be greater than zero",
    );
  }

  const orderedSegments = [...segments].sort(
    (a, b) => a.segmentIndex - b.segmentIndex,
  );

  const chunks: RagChunk[] = [];

  let currentSegments: RagChunkInputSegment[] = [];
  let currentStartSeconds: number | undefined;

  for (const segment of orderedSegments) {
    const text = segment.text.trim();

    if (!text) {
      continue;
    }

    if (segment.endSeconds <= segment.startSeconds) {
      continue;
    }

    if (currentSegments.length === 0) {
      currentSegments = [segment];
      currentStartSeconds = segment.startSeconds;
      continue;
    }

    const startSeconds = currentStartSeconds!;
    const currentDuration =
      segment.endSeconds - startSeconds;

    if (
      currentDuration > targetDuration &&
      currentSegments.length > 0
    ) {
      chunks.push(
        createRagChunk(
          chunks.length,
          currentSegments,
        ),
      );

      currentSegments = [segment];
      currentStartSeconds = segment.startSeconds;
      continue;
    }

    currentSegments.push(segment);
  }

  if (currentSegments.length > 0) {
    chunks.push(
      createRagChunk(
        chunks.length,
        currentSegments,
      ),
    );
  }

  return chunks;
}

function createRagChunk(
  chunkIndex: number,
  segments: RagChunkInputSegment[],
): RagChunk {
  const firstSegment = segments[0];
  const lastSegment =
    segments[segments.length - 1];

  if (!firstSegment || !lastSegment) {
    throw new Error(
      "Cannot create RAG chunk without segments",
    );
  }

  const embeddingText = segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ");

  const displayText = segments
    .map(
      (segment) =>
        `${segment.startSeconds.toFixed(2)} - ` +
        `${segment.endSeconds.toFixed(2)} : ` +
        segment.text.trim(),
    )
    .join("\n");

  return {
    chunkIndex,
    embeddingText,
    displayText,
    startSeconds: firstSegment.startSeconds,
    endSeconds: lastSegment.endSeconds,
  };
}