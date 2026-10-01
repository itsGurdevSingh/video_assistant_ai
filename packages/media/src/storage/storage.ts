import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

import path from "node:path";

export class LocalStorage {
  constructor(private readonly root: string) {}

  async ensureDirectory(key = ""): Promise<void> {
    await mkdir(this.getPath(key), {
      recursive: true,
    });
  }

  getPath(key: string): string {
    return path.join(this.root, key);
  }

  async write(key: string, data: Buffer): Promise<void> {
    const directory = path.dirname(key);

    await this.ensureDirectory(directory);

    await writeFile(this.getPath(key), data);
  }

  async writeStream(key: string, stream: Readable): Promise<number> {
    const directory = path.dirname(key);

    await this.ensureDirectory(directory);

    let byteCount = 0;
    stream.on("data", (chunk: Buffer | string) => {
      byteCount += Buffer.byteLength(chunk);
    });

    await pipeline(stream, createWriteStream(this.getPath(key)));

    return byteCount;
  }

  async delete(key: string): Promise<void> {
    await unlink(this.getPath(key)).catch(() => {});
  }

  async deleteDirectory(key: string): Promise<void> {
    await rm(this.getPath(key), {
      recursive: true,
      force: true,
    });
  }
}
