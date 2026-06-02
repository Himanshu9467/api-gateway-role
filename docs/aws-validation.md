# AWS Validation

The gateway supports local storage and S3 storage. AWS checks run only when `STORAGE_PROVIDER=s3`, so tests and local development do not require credentials.

Required environment:

```bash
STORAGE_PROVIDER=s3
S3_BUCKET=<bucket>
S3_REGION=<region>
S3_PREFIX=documents
```

Startup validation:

- Validates `S3_BUCKET` and `S3_REGION`.
- Calls `HeadBucket` to prove the bucket exists and the principal can access it.
- Calls `ListObjectsV2` with `S3_PREFIX` and `MaxKeys=1` to prove list/read metadata access.

Runtime validation:

- Uploads use `PutObject` with SHA-256 checksum metadata.
- Downloads use presigned `GetObject` URLs.
- Document rows persist provider, bucket, key, checksum, content type, and metadata.

Minimum IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET",
      "Condition": { "StringLike": { "s3:prefix": ["documents/*", "documents"] } }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET/documents/*"
    }
  ]
}
```

Recommended validation steps:

1. Deploy with `STORAGE_PROVIDER=s3`.
2. Confirm startup succeeds and `/health` is healthy.
3. Upload a PDF through `POST /api/onboarding/:clientId/documents/upload`.
4. Confirm the `Document` row contains `storageProvider=s3`, `bucket`, `storageKey`, and `checksum`.
5. Request `GET /api/onboarding/:clientId/documents/:documentId/download-url`.
6. Fetch the presigned URL before expiration and verify bytes match the uploaded file.

Residual risk:

- The gateway cannot prove `GetObject` works at startup without creating test objects. That is intentionally avoided to keep startup non-mutating.
