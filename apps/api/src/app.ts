import Fastify from "fastify";
import multipart from "@fastify/multipart";

import { db, pool } from "@video-assistant/db";

import { videoRoutes } from "./routes/videos.js";
import { authRoutes } from "./routes/auth.js";
import { createContainer } from "./container.js";

const container = createContainer();

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Register plugins and routes
  await app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024,
      files: 1,
    },
  });

  // Health check route
  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  app.addHook("onReady", async () => {
    await db.execute("SELECT 1");
  });

  app.addHook("onClose", async () => {
    await pool.end();
  });

  await app.register(videoRoutes, { container });
  await app.register(authRoutes, { container });

  return app;
}
