import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../container.js";

export async function authRoutes(
  app: FastifyInstance,
  options: { container: AppContainer },
) {
  const { authService } = options.container;

  app.post("/auth/register", async (request, reply) => {
    const body = request.body as
      | { email?: unknown; password?: unknown; name?: unknown }
      | undefined;

    if (
      typeof body?.email !== "string" ||
      typeof body.password !== "string" ||
      typeof body.name !== "string"
    ) {
      return reply.status(400).send({
        error: "Name, email, and password are required",
      });
    }

    try {
      return reply.status(201).send(
        await authService.register({
          email: body.email,
          password: body.password,
          name: body.name,
        }),
      );
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const body = request.body as
      | { email?: unknown; password?: unknown }
      | undefined;

    if (typeof body?.email !== "string" || typeof body.password !== "string") {
      return reply.status(400).send({
        error: "Email and password are required",
      });
    }

    try {
      return reply.status(200).send(
        await authService.login({
          email: body.email,
          password: body.password,
        }),
      );
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await getAuthenticatedUser(request, authService);

    if (!user)
      return reply.status(401).send({ error: "Authentication required" });
    return reply.status(200).send({ user });
  });

  app.post("/auth/logout", async (request, reply) => {
    await authService.logout(getBearerToken(request));
    return reply.status(204).send();
  });
}

export function getBearerToken(request: {
  headers: { authorization?: string };
}) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export async function getAuthenticatedUser(
  request: { headers: { authorization?: string } },
  authService: AppContainer["authService"],
) {
  return authService.authenticateToken(getBearerToken(request));
}

function sendAuthError(
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "Email is already registered") {
    return reply.status(409).send({ error: message });
  }

  if (
    message === "Invalid email or password" ||
    message === "A valid email is required" ||
    message === "Password must be at least 8 characters" ||
    message === "Name cannot be empty"
  ) {
    return reply.status(400).send({ error: message });
  }

  return reply.status(500).send({ error: "Authentication failed" });
}
