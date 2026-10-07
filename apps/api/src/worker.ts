import { createContainer } from "./container.js";

const container = createContainer();
const pollIntervalMs = Number(process.env.VIDEO_WORKER_POLL_MS ?? 1000);

let stopping = false;

function stop() {
  stopping = true;
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log("Video worker started");

while (!stopping) {
  const video = await container.videoService.claimNextQueued();

  if (!video) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    continue;
  }

  console.log(`Processing video ${video.id}`);

  await container.videoProcessingService.processVideo(video.id).catch((error) => {
    console.error(`Failed to process video ${video.id}:`, error);
  });
}

console.log("Video worker stopped");