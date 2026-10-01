import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import {
  createAuthSessionRepository,
  createUserRepository,
  type Database,
} from "@video-assistant/db";

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const SCRYPT_KEY_LENGTH = 64;

type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

export function createAuthService(db: Database) {
  const userRepository = createUserRepository(db);
  const sessionRepository = createAuthSessionRepository(db);

  return {
    async register(input: { email: string; password: string; name: string }) {
      const email = normalizeEmail(input.email);
      const name = input.name.trim();
      validateCredentials(email, input.password, name);

      if (await userRepository.findByEmail(email)) {
        throw new Error("Email is already registered");
      }

      const user = await userRepository.create({
        email,
        name,
        passwordHash: await hashPassword(input.password),
      });

      if (!user) {
        throw new Error("Failed to create user");
      }

      return createLoginResult(user);
    },

    async login(input: { email: string; password: string }) {
      const email = normalizeEmail(input.email);
      const user = await userRepository.findByEmail(email);

      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new Error("Invalid email or password");
      }

      return createLoginResult(user);
    },

    async authenticateToken(token: string | undefined) {
      if (!token) return null;

      const result = await sessionRepository.findActiveByTokenHash(
        hashToken(token),
      );
      return result ? toPublicUser(result.user) : null;
    },

    async logout(token: string | undefined) {
      if (token) await sessionRepository.deleteByTokenHash(hashToken(token));
    },
  };

  async function createLoginResult(user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    passwordHash: string;
  }) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await sessionRepository.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    });

    return {
      token,
      expiresAt,
      user: toPublicUser(user),
    };
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateCredentials(email: string, password: string, name: string) {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("A valid email is required");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (!name) {
    throw new Error("Name cannot be empty");
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [, salt, expectedHex] = storedHash.split("$");
  if (!salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
