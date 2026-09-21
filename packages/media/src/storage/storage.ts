import {
  mkdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

export class LocalStorage {
  constructor(
    private readonly root: string,
  ) {}

  async ensureDirectory(
    key = "",
  ): Promise<void> {
    await mkdir(
      this.getPath(key),
      {
        recursive: true,
      },
    );
  }

  getPath(key: string): string {
    return path.join(
      this.root,
      key,
    );
  }

  async write(
    key: string,
    data: Buffer,
  ): Promise<void> {
    const directory =
      path.dirname(key);

    await this.ensureDirectory(
      directory,
    );

    await writeFile(
      this.getPath(key),
      data,
    );
  }

  async delete(
    key: string,
  ): Promise<void> {
    await unlink(
      this.getPath(key),
    ).catch(() => {});
  }

  async deleteDirectory(
    key: string,
  ): Promise<void> {
    await rm(
      this.getPath(key),
      {
        recursive: true,
        force: true,
      },
    );
  }
}