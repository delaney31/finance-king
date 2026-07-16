import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageConfig, StorageProvider } from "./types";

export function createS3Storage(config: StorageConfig): StorageProvider {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });

  return {
    async upload(key, data, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        })
      );
    },

    async download(key) {
      const res = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key })
      );
      const bytes = await res.Body?.transformToByteArray();
      return Buffer.from(bytes ?? []);
    },

    async getSignedUrl(key, expiresInSeconds = 300) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: expiresInSeconds }
      );
    },

    async delete(key) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      );
    },
  };
}

export function getStorage(): StorageProvider {
  return createS3Storage({
    endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:9000",
    region: process.env.STORAGE_REGION ?? "us-east-1",
    accessKey: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.STORAGE_SECRET_KEY ?? "minioadmin",
    bucket: process.env.STORAGE_BUCKET ?? "finance-king-uploads",
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  });
}
