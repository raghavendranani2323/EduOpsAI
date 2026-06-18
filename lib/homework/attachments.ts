import { randomUUID } from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";

export const HOMEWORK_BUCKET = "homework";
export const HOMEWORK_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const ALLOWED_TYPES: Record<string, { mime: string; ext: string; signatures: number[][] }> = {
  "image/jpeg": { mime: "image/jpeg", ext: "jpg", signatures: [[0xff, 0xd8, 0xff]] },
  "image/png": { mime: "image/png", ext: "png", signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  "image/webp": { mime: "image/webp", ext: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]] },
  "application/pdf": { mime: "application/pdf", ext: "pdf", signatures: [[0x25, 0x50, 0x44, 0x46]] },
};

export function getHomeworkStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new ApiError(500, "STORAGE_NOT_CONFIGURED", "Storage is not configured");
  }
  return createServiceClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

function cleanExtension(name: string) {
  return name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function hasSignature(bytes: Uint8Array, signatures: number[][]) {
  return signatures.some(signature => signature.every((value, index) => bytes[index] === value));
}

export async function validateHomeworkFile(file: File) {
  if (file.size <= 0) throw new ApiError(400, "EMPTY_FILE", "File is empty");
  if (file.size > HOMEWORK_MAX_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "File too large (max 5 MB)");

  const allowed = ALLOWED_TYPES[file.type];
  if (!allowed) {
    throw new ApiError(415, "UNSUPPORTED_FILE_TYPE", "Use JPEG, PNG, WebP, or PDF files only");
  }

  const ext = cleanExtension(file.name);
  if (ext !== allowed.ext && !(file.type === "image/jpeg" && ext === "jpeg")) {
    throw new ApiError(415, "FILE_EXTENSION_MISMATCH", "File extension does not match the uploaded file type");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasSignature(header, allowed.signatures)) {
    throw new ApiError(415, "FILE_SIGNATURE_MISMATCH", "File content does not match the uploaded file type");
  }
  if (file.type === "image/webp") {
    const webp = [0x57, 0x45, 0x42, 0x50];
    if (!webp.every((value, index) => header[index + 8] === value)) {
      throw new ApiError(415, "FILE_SIGNATURE_MISMATCH", "File content does not match the uploaded file type");
    }
  }

  return allowed;
}

export function buildHomeworkObjectKey(institutionId: string, classId: string, userId: string, ext: string) {
  return `${institutionId}/${classId}/${userId}/${Date.now()}-${randomUUID()}.${ext}`;
}

export function isHomeworkObjectKeyForInstitution(key: string, institutionId: string) {
  return key.startsWith(`${institutionId}/`) && !key.includes("..") && !key.includes("\\");
}

export function isHomeworkObjectKeyForClass(key: string, institutionId: string, classId: string) {
  return key.startsWith(`${institutionId}/${classId}/`) && !key.includes("..") && !key.includes("\\");
}

export async function createHomeworkSignedUrl(key: string | null | undefined) {
  if (!key || /^https?:\/\//i.test(key)) return null;
  const admin = getHomeworkStorageClient();
  const { data, error } = await admin.storage.from(HOMEWORK_BUCKET).createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
