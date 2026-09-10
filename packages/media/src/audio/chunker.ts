import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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

export async function chunkAudio(
  audioPath: string,
  outputDir: string,
  options: ChunkAudioOptions = {},
): Promise<AudioChunk[]> {
  const chunkDurationSeconds =
    options.chunkDurationSeconds ?? 300;

  if (chunkDurationSeconds <= 0) {
    throw new Error("chunkDurationSeconds must be greater than 0");
  }

  await mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "chunk-%03d.wav");

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

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args);

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function buildChunkMetadata(
  outputDir: string,
  chunkDurationSeconds: number,
): Promise<AudioChunk[]> {
  const { readdir } = await import("node:fs/promises");

  const files = (await readdir(outputDir))
    .filter((file) => /^chunk-\d{3}\.wav$/.test(file))
    .sort();

  return files.map((file, index) => ({
    index,
    path: path.join(outputDir, file),
    startSeconds: index * chunkDurationSeconds,
    endSeconds: (index + 1) * chunkDurationSeconds,
  }));
}