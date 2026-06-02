import path from "node:path";
import { env } from "../../config/env";
import { LocalStorageProvider } from "./localStorageProvider";
import { S3StorageProvider } from "./s3StorageProvider";
import type { StorageProvider } from "./storageProvider";

let provider: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (provider) return provider;

  provider =
    env.STORAGE_PROVIDER === "s3"
      ? new S3StorageProvider({
          bucket: env.S3_BUCKET ?? "",
          region: env.S3_REGION ?? "",
          prefix: env.S3_PREFIX
        })
      : new LocalStorageProvider(path.resolve(__dirname, "../../../../", env.LOCAL_STORAGE_DIR));

  return provider;
}

export type { StorageProvider, StoredDocument, StoreDocumentInput } from "./storageProvider";
