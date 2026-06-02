import { createHash } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, StoreDocumentInput, StoredDocument } from "./storageProvider";

interface S3StorageProviderOptions {
  bucket: string;
  region: string;
  prefix: string;
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageProviderOptions) {
    this.client = new S3Client({ region: options.region });
  }

  async storeDocument(input: StoreDocumentInput): Promise<StoredDocument> {
    const bytes = input.bytes ?? Buffer.alloc(0);
    const key = `${this.options.prefix}/${input.clientId}/${input.documentId}-${sanitize(input.fileName)}`;
    const storedAt = new Date().toISOString();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const checksumBase64 = createHash("sha256").update(bytes).digest("base64");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: bytes,
        ContentType: input.mimeType,
        ChecksumSHA256: bytes.length > 0 ? checksumBase64 : undefined,
        Metadata: {
          documentId: input.documentId,
          fileName: input.fileName,
          checksum,
          storedAt
        }
      })
    );
    return {
      provider: "s3",
      url: `s3://${this.options.bucket}/${key}`,
      path: key,
      bucket: this.options.bucket,
      key,
      size: bytes.length,
      checksum,
      contentType: input.mimeType,
      metadata: {
        ...input.metadata,
        bucket: this.options.bucket,
        key,
        checksum,
        region: this.options.region,
        storedAt
      }
    };
  }

  async getDownloadUrl(input: { bucket?: string | null; key: string; expiresInSeconds: number }): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: input.bucket ?? this.options.bucket,
        Key: input.key
      }),
      { expiresIn: input.expiresInSeconds }
    );
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
