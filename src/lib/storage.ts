import fs from "fs/promises";
import path from "path";

/**
 * Storage abstraction so the local-disk pilot backend can be swapped for
 * S3-compatible object storage later without touching callers.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

function resolveSafe(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

class LocalDiskStorage implements Storage {
  async put(key: string, data: Buffer): Promise<void> {
    const full = resolveSafe(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(resolveSafe(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolveSafe(key), { force: true });
  }
}

export const storage: Storage = new LocalDiskStorage();
