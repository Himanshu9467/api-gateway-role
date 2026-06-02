import { createHash } from "crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, StoreDocumentInput, StoredDocument } from "./storageProvider";

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async storeDocument(input: StoreDocumentInput): Promise<StoredDocument> {
    const bytes = input.bytes ?? Buffer.alloc(0);
    const relativePath = path.join(input.clientId, `${input.documentId}-${sanitize(input.fileName)}`);
    const absolutePath = path.resolve(this.rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const storedAt = new Date().toISOString();

    return {
      provider: "local",
      url: `local://${relativePath.replace(/\\/g, "/")}`,
      path: absolutePath,
      key: relativePath.replace(/\\/g, "/"),
      size: bytes.length,
      checksum,
      contentType: input.mimeType,
      metadata: {
        ...input.metadata,
        storedAt
      }
    };
  }

  async getDownloadUrl(input: { path: string }): Promise<string> {
    return `local://${path.relative(this.rootDir, input.path).replace(/\\/g, "/")}`;
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
