export interface StoreDocumentInput {
  clientId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  bytes?: Buffer;
  metadata?: Record<string, unknown>;
}

export interface StoredDocument {
  provider: "local" | "s3";
  url: string;
  path: string;
  bucket?: string;
  key: string;
  size: number;
  checksum: string;
  contentType: string;
  metadata: Record<string, unknown>;
}

export interface StorageProvider {
  storeDocument(input: StoreDocumentInput): Promise<StoredDocument>;
  getDownloadUrl?(input: {
    bucket?: string | null;
    key: string;
    path: string;
    expiresInSeconds: number;
  }): Promise<string>;
}
