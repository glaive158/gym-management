import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const RESIZE_WIDTH = 512;

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function saveAvatar(buffer: Buffer): Promise<UploadResult> {
  if (buffer.length > MAX_BYTES) {
    return { success: false, error: "Image trop volumineuse (5 Mo max)" };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return { success: false, error: "Format non supporté (JPEG/PNG/WebP uniquement)" };
  }

  const resized = await sharp(buffer)
    .resize({ width: RESIZE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString("hex")}.jpg`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), resized);

  return { success: true, url: `/uploads/${filename}` };
}
