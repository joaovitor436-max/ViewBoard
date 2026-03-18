import * as Minio from "minio";

const MINIO_ENDPOINT = process.env["MINIO_ENDPOINT"] ?? "localhost";
const MINIO_PORT = parseInt(process.env["MINIO_PORT"] ?? "9000", 10);
const MINIO_USE_SSL = process.env["MINIO_USE_SSL"] === "true";
const MINIO_ACCESS_KEY = process.env["MINIO_ACCESS_KEY"] ?? "minio_access_key";
const MINIO_SECRET_KEY = process.env["MINIO_SECRET_KEY"] ?? "minio_secret_key";
export const MINIO_BUCKET = process.env["MINIO_BUCKET"] ?? "viewboard";

export const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

export async function ensureBucketExists(bucket: string): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, "us-east-1");
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/public/*`],
        },
      ],
    });
    await minioClient.setBucketPolicy(bucket, policy);
  }
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await minioClient.putObject(MINIO_BUCKET, objectName, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return `/${MINIO_BUCKET}/${objectName}`;
}

export async function deleteFile(objectName: string): Promise<void> {
  await minioClient.removeObject(MINIO_BUCKET, objectName);
}

export async function getPresignedUrl(
  objectName: string,
  expirySeconds = 3600
): Promise<string> {
  return minioClient.presignedGetObject(MINIO_BUCKET, objectName, expirySeconds);
}
