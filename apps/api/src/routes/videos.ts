import type { FastifyInstance, FastifyReply } from "fastify";
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
      file.mimetype.startsWith("video/") || allowedVideoExtensions.has(exten);

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

  app.post("/videos/:videoId/chat/sessions", async (request, reply) => {
    const { videoId } = request.params as { videoId: string };
    const body = request.body as { title?: unknown } | undefined;

    if (body?.title !== undefined && typeof body.title !== "string") {
      return reply.status(400).send({
        error: "Session title must be a string",
      });
    }

    try {
      const session = await container.chatSessionService.createSession({
        videoId,
        title: body?.title,
      });

      return reply.status(201).send(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.startsWith("Video not found")) {
        return reply.status(404).send({ error: message });
      }

      return reply.status(500).send({
        error: "Failed to create chat session",
      });
    }
  });

  app.get("/videos/:videoId/chat/sessions", async (request, reply) => {
    const { videoId } = request.params as { videoId: string };

    try {
      const sessions = await container.chatSessionService.listSessions(videoId);

      return reply.status(200).send(sessions);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.startsWith("Video not found")) {
        return reply.status(404).send({ error: message });
      }

      return reply.status(500).send({
        error: "Failed to list chat sessions",
      });
    }
  });

  app.post(
    "/videos/:videoId/chat/sessions/:sessionId/messages",
    async (request, reply) => {
      const { videoId, sessionId } = request.params as {
        videoId: string;
        sessionId: string;
      };

      const body = request.body as
        | {
            question?: string;
          }
        | undefined;

      if (typeof body?.question !== "string" || !body.question.trim()) {
        return reply.status(400).send({
          error: "Question is required",
        });
      }

      try {
        const result = await container.chatService.askQuestion({
          videoId,
          sessionId,
          question: body.question,
        });

        return reply.status(200).send(result);
      } catch (error) {
        return sendChatError(reply, error);
      }
    },
  );

  app.post("/videos/:videoId/chat", async (request, reply) => {
    const { videoId } = request.params as {
      videoId: string;
    };

    const body = request.body as
      | {
          sessionId?: string;
          question?: string;
        }
      | undefined;

    if (typeof body?.question !== "string" || !body.question.trim()) {
      return reply.status(400).send({
        error: "Question is required",
      });
    }

    try {
      const result = await container.chatService.askQuestion({
        videoId,
        sessionId: body.sessionId,
        question: body.question,
      });

      return reply.status(200).send(result);
    } catch (error) {
      console.error("VIDEO CHAT ERROR:", error);

      return sendChatError(reply, error);
    }
  });
}

function sendChatError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.startsWith("Video not found") ||
    message.startsWith("Transcript not found") ||
    message.startsWith("Chat session not found")
  ) {
    return reply.status(404).send({ error: message });
  }

  if (message.startsWith("Video is not ready")) {
    return reply.status(409).send({ error: message });
  }

  return reply.status(500).send({
    error: "Failed to answer video question",
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
