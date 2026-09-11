import { basename } from "node:path";
import { readFile } from "node:fs/promises";

export type TranscriptionSegment = {
  index: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
};

export type TranscriptionResult = {
  text: string;
  segments: TranscriptionSegment[];
};

type WhisperCppResponse = {
  text?: unknown;
  segments?: unknown;
};

type WhisperCppSegment = {
  id?: unknown;
  text?: unknown;
  start?: unknown;
  end?: unknown;
};

export type WhisperCppProviderOptions = {
  baseUrl?: string;
};

export class WhisperCppProvider {
  private readonly baseUrl: string;

  constructor(options: WhisperCppProviderOptions = {}) {
    this.baseUrl = options.baseUrl ?? "http://localhost:8080";
  }

  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    const form = new FormData();

    const file = await readFile(audioPath);

    form.append("response_format", "verbose_json");

    form.append("file", new Blob([file]), basename(audioPath));

    const response = await fetch(`${this.baseUrl}/inference`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `Whisper transcription failed (${response.status}): ${body}`,
      );
    }

    const raw = await response.json();

    return parseWhisperResponse(raw);
  }
}

function parseWhisperResponse(raw: unknown): TranscriptionResult {
  if (!isRecord(raw)) {
    throw new Error("Invalid Whisper response: expected an object");
  }

  const text = raw.text;

  if (typeof text !== "string") {
    throw new Error("Invalid Whisper response: missing text");
  }

  const segments = raw.segments;

  if (!Array.isArray(segments)) {
    throw new Error("Invalid Whisper response: missing segments");
  }

  return {
    text: text.trim(),
    segments: segments.map((segment, index) =>
      parseWhisperSegment(segment, index),
    ),
  };
}

function parseWhisperSegment(
  raw: unknown,
  index: number,
): TranscriptionSegment {
  if (!isRecord(raw)) {
    throw new Error(`Invalid Whisper segment at index ${index}`);
  }

  const text = raw.text;
  const start = raw.start;
  const end = raw.end;

  if (typeof text !== "string") {
    throw new Error(`Invalid Whisper segment ${index}: missing text`);
  }

  if (typeof start !== "number") {
    throw new Error(`Invalid Whisper segment ${index}: missing start`);
  }

  if (typeof end !== "number") {
    throw new Error(`Invalid Whisper segment ${index}: missing end`);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(`Invalid Whisper segment ${index}: invalid timestamp`);
  }

  if (end < start) {
    throw new Error(`Invalid Whisper segment ${index}: end before start`);
  }

  return {
    index,
    text: text.trim(),
    startSeconds: start,
    endSeconds: end,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
