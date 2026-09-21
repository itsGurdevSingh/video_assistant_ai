import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

export function downloadYouTubeVideo(
  url: string,
  outputPath: string,
  quality: "best" | "1080" | "720" | "480" | "360"| "144" = "best",
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Build the format selector based on quality
    const format =
      quality === "best"
        ? "bv*+ba/b"
        : `bv*[height<=${quality}]+ba/b[height<=${quality}]`;

    const child = spawn("yt-dlp", [
      "-f",
      format,
      "--merge-output-format",
      "mp4",
      "-o",
      outputPath,
      url,
    ]);

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
  });
}

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export function downloadYouTubeAudio(
  url: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", [
      "-f",
      "ba",
      "-o",
      outputPath,
      url,
    ]);

    let settled = false;

    const cleanup = async () => {
      await rm(outputPath, {
        force: true,
      }).catch(() => {});
    };

    const fail = async (error: Error) => {
      if (settled) return;

      settled = true;

      child.kill("SIGTERM");

      await cleanup();

      reject(error);
    };

    const timeout = setTimeout(() => {
      void fail(
        new Error(
          `yt-dlp download timed out after ${
            DOWNLOAD_TIMEOUT_MS / 1000
          } seconds`,
        ),
      );
    }, DOWNLOAD_TIMEOUT_MS);

    child.stderr.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      void fail(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (settled) return;

      if (code === 0) {
        settled = true;
        resolve();
        return;
      }

      void fail(
        new Error(
          `yt-dlp exited with code ${code}`,
        ),
      );
    });
  });
}