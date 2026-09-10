import Fastify from "fastify";

import { db, pool } from "@video-assistant/db";

import { videoRoutes } from "./routes/videos.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

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


  await app.register(videoRoutes);

  return app;
}