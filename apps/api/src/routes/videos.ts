import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createVideo } from "../services/video.service.js";

const createVideoSchema = z.object({
  userId: z.uuid(),
  sourceType: z.enum(["youtube", "upload"]),
  sourceUrl: z.url().optional(),
  title: z.string().min(1).optional(),
  durationSeconds: z.number().positive().optional(),
});

export async function videoRoutes(app: FastifyInstance) {
  app.post("/videos", async (request, reply) => {
    const input = createVideoSchema.parse(request.body);

    const video = await createVideo(input);

    return reply.status(201).send(video);
  });
}