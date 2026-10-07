import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppContainer } from "../container.js";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getAuthenticatedUser } from "./auth.js";

export async function videoRoutes(
  app: FastifyInstance,
  options: {
    container: AppContainer;
  },
) {
  const { container } = options;

  app.get("/videos", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

    return reply
      .status(200)
      .send(await container.videoService.listByUser(user.id));
  });

  app.post("/videos", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

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

    const videoId = crypto.randomUUID();

    const extension = getExtension(file.filename, file.mimetype);

    const storageKey = `uploads/${videoId}${extension}`;

    const byteCount = await container.storage.writeStream(
      storageKey,
      file.file,
    );

    if (byteCount === 0) {
      await container.storage.delete(storageKey).catch(() => {});
      return reply.status(400).send({
        error: "Uploaded video is empty",
      });
    }

    try {
      const video = await container.videoService.createVideo({
        userId: user.id,
        sourceType: "upload",
        storageKey,
        title: file.filename,
      });

      return reply.status(202).send(video);
    } catch (error) {
      console.error("VIDEO UPLOAD ERROR:", error);
      await container.storage.delete(storageKey).catch(() => {});

      throw error;
    }
  });

  app.get("/videos/:videoId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

    const { videoId } = request.params as { videoId: string };
    const video = await container.videoService.findByIdForUser(
      videoId,
      user.id,
    );

    if (!video) {
      return reply.status(404).send({ error: "Video not found" });
    }

    return reply.status(200).send(video);
  });

  app.get("/videos/:videoId/file", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

    const { videoId } = request.params as { videoId: string };
    const video = await container.videoService.findByIdForUser(
      videoId,
      user.id,
    );

    if (!video?.storageKey) {
      return reply.status(404).send({ error: "Video file not found" });
    }

    const filePath = container.storage.getPath(video.storageKey);

    try {
      await stat(filePath);
    } catch {
      return reply.status(404).send({ error: "Video file not found" });
    }

    return reply
      .type(getVideoMimeType(video.storageKey))
      .send(createReadStream(filePath));
  });

  app.post("/videos/:videoId/chat/sessions", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

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
        userId: user.id,
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
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

    const { videoId } = request.params as { videoId: string };

    try {
      const sessions = await container.chatSessionService.listSessions(
        videoId,
        user.id,
      );

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

  app.get(
    "/videos/:videoId/chat/sessions/:sessionId/messages",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, container);
      if (!user) return;

      const { videoId, sessionId } = request.params as {
        videoId: string;
        sessionId: string;
      };

      try {
        const messages = await container.chatMessageService.listMessages({
          videoId,
          userId: user.id,
          sessionId,
        });

        return reply.status(200).send(messages);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (
          message.startsWith("Video not found") ||
          message.startsWith("Chat session not found")
        ) {
          return reply.status(404).send({ error: message });
        }

        return reply.status(500).send({
          error: "Failed to load chat messages",
        });
      }
    },
  );

  app.post(
    "/videos/:videoId/chat/sessions/:sessionId/messages",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, container);
      if (!user) return;

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
          userId: user.id,
          sessionId,
          question: body.question,
        });

        return reply.status(200).send(result);
      } catch (error) {
        return sendChatError(reply, error);
      }
    },
  );

  app.post(
    "/videos/:videoId/chat/sessions/:sessionId/messages/stream",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply, container);
      if (!user) return;

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

      reply.hijack();
      const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": allowedOrigin,
        Vary: "Origin",
      });

      try {
        const events = container.chatService.streamQuestion({
          videoId,
          userId: user.id,
          sessionId,
          question: body.question,
        });

        for await (const event of events) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }
    },
  );

  app.post("/videos/:videoId/chat", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, container);
    if (!user) return;

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
        userId: user.id,
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

async function requireAuthenticatedUser(
  request: { headers: { authorization?: string } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  container: AppContainer,
) {
  const user = await getAuthenticatedUser(request, container.authService);

  if (!user) {
    reply.status(401).send({ error: "Authentication required" });
    return null;
  }

  return user;
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

function getVideoMimeType(storageKey: string): string {
  switch (path.extname(storageKey).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}
