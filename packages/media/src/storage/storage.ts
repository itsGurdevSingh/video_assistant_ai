import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";

export class LocalStorage {
  constructor(private readonly root: string) {}

  async ensureDirectory() {
    await mkdir(this.root, { recursive: true });
  }

  getPath(key: string) {
    return path.join(this.root, key);
  }

  async delete(key: string) {
    await unlink(this.getPath(key)).catch(() => {});
  }
}