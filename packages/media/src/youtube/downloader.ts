import { spawn } from "node:child_process";

export function downloadYouTubeVideo(
  url: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", [
      "-f",
      "bv*+ba/b",
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