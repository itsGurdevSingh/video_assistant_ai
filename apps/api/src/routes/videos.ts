import type { FastifyInstance } from "fastify";
import type { AppContainer } from "../container.js";
import path from "node:path";

export async function videoRoutes(
  app: FastifyInstance,
  options: {
    container: AppContainer;
  },
) {
  const { container } = options;

  app.post("/videos", async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.status(400).send({
        error: "Video file is required",
      });
    }

    const exten = path.extname(file.filename).toLowerCase();

    const allowedVideoExtensions = new Set([
      ".mp4",
      ".mov",
      ".mkv",
      ".webm",
      ".avi",
    ]);

    const isVideo =
      file.mimetype.startsWith("video/") ||
      allowedVideoExtensions.has(exten);

    if (!isVideo) {
      return reply.status(400).send({
        error: "Only video files are supported",
      });
    }

    const buffer = await file.toBuffer();

    if (buffer.length === 0) {
      return reply.status(400).send({
        error: "Uploaded video is empty",
      });
    }

    const videoId = crypto.randomUUID();

    const extension = getExtension(file.filename, file.mimetype);

    const storageKey = `uploads/${videoId}${extension}`;

    await container.storage.write(storageKey, buffer);

    try {
      const video = await container.videoService.createVideo({
        userId: "cc2f365d-0816-4f25-b709-35a6fedb8242",
        sourceType: "upload",
        storageKey,
        title: file.filename,
      });

      await container.videoProcessingService.processVideo(video.id);

      const processedVideo = await container.videoService.findById(video.id);

      return reply.status(201).send(processedVideo);
    } catch (error) {
      console.error("VIDEO UPLOAD ERROR:", error);
      await container.storage.delete(storageKey).catch(() => {});

      throw error;
    }
  });
}

function getExtension(filename: string, mimetype: string): string {
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";

  if (extension) {
    return extension.toLowerCase();
  }

  if (mimetype === "video/mp4") {
    return ".mp4";
  }

  return ".video";
}
