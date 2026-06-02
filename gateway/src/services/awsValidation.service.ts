import { HeadBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";

export async function validateAwsStorageStartup(): Promise<void> {
  if (env.STORAGE_PROVIDER !== "s3") return;
  if (!env.S3_BUCKET || !env.S3_REGION) {
    throw new Error("S3_BUCKET and S3_REGION are required when STORAGE_PROVIDER=s3");
  }

  const client = new S3Client({ region: env.S3_REGION });
  await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  await client.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET,
      Prefix: env.S3_PREFIX,
      MaxKeys: 1
    })
  );
}
