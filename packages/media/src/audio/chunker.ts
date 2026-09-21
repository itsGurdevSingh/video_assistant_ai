import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export type AudioChunk = {
  index: number;
  path: string;
  startSeconds: number;
  endSeconds: number;
};

export type ChunkAudioOptions = {
  chunkDurationSeconds?: number;
};

const DEFAULT_CHUNK_DURATION_SECONDS = 300;

export async function chunkAudio(
  audioPath: string,
  outputDir: string,
  options: ChunkAudioOptions = {},
): Promise<AudioChunk[]> {
  const chunkDurationSeconds =
    options.chunkDurationSeconds ??
    DEFAULT_CHUNK_DURATION_SECONDS;

  if (
    !Number.isFinite(chunkDurationSeconds) ||
    chunkDurationSeconds <= 0
  ) {
    throw new Error(
      "chunkDurationSeconds must be greater than zero",
    );
  }

  await mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(
    outputDir,
    "chunk-%03d.wav",
  );

  await runFfmpeg([
    "-y",
    "-i",
    audioPath,
    "-f",
    "segment",
    "-segment_time",
    String(chunkDurationSeconds),
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPattern,
  ]);

  return buildChunkMetadata(
    outputDir,
    chunkDurationSeconds,
  );
}

async function buildChunkMetadata(
  outputDir: string,
  chunkDurationSeconds: number,
): Promise<AudioChunk[]> {
  const files = (await readdir(outputDir))
    .filter((file) => /^chunk-\d{3}\.wav$/.test(file))
    .sort();

  if (files.length === 0) {
    throw new Error("FFmpeg produced no audio chunks");
  }

  const chunks: AudioChunk[] = [];

  for (const [index, file] of files.entries()) {
    const filePath = path.join(outputDir, file);

    const startSeconds =
      index * chunkDurationSeconds;

    const durationSeconds =
      await getAudioDuration(filePath);

    const endSeconds =
      startSeconds + durationSeconds;

    chunks.push({
      index,
      path: filePath,
      startSeconds,
      endSeconds,
    });
  }

  return chunks;
}

async function getAudioDuration(
  audioPath: string,
): Promise<number> {
  const output = await runFfprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath,
  ]);

  const durationSeconds = Number.parseFloat(
    output.trim(),
  );

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new Error(
      `Invalid audio duration for chunk: ${audioPath}`,
    );
  }

  return durationSeconds;
}

async function runFfmpeg(
  args: string[],
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args);

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`ffmpeg exited with code ${code}`),
      );
    });
  });
}

async function runFfprobe(
  args: string[],
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffprobe", args);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          `ffprobe exited with code ${code}: ${stderr.trim()}`,
        ),
      );
    });
  });
}