/**
 * Private investigation-board object storage (DI-9.5D).
 *
 * Server-only. Uses the service-role key against a PRIVATE bucket.
 * Never returns a permanent public URL. Signed URLs are runtime-only.
 */

import { resolveSupabaseUrl, type SupabaseStorageConfig } from "@/lib/portrait/portrait_storage";
import { DRUG_INTELLIGENCE_BUCKET_DEFAULT } from "@/lib/storage/storage_config";
import { BOARD_IMAGE_SIGNED_TTL_SECONDS } from "@/lib/drug_intelligence/drug_investigation_board_image_validation";

export interface BoardImageObjectStore {
  put(input: { storagePath: string; bytes: Uint8Array; mimeType: string }): Promise<void>;
  get(storagePath: string): Promise<Uint8Array>;
  remove(storagePath: string): Promise<void>;
  sign(storagePath: string, expiresInSeconds?: number): Promise<{ url: string; expiresAt: Date }>;
  publicObjectUrl(storagePath: string): string;
}

export class BoardImageStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardImageStorageConfigError";
  }
}

export function resolveBoardImageStorageConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseStorageConfig | null {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;
  const supabaseUrl = resolveSupabaseUrl(env);
  if (!supabaseUrl) return null;
  const bucket = env.SUPABASE_DRUG_INTELLIGENCE_BUCKET?.trim() || DRUG_INTELLIGENCE_BUCKET_DEFAULT;
  return { supabaseUrl, serviceRoleKey, bucket };
}

export class InMemoryBoardImageObjectStore implements BoardImageObjectStore {
  readonly objects = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  signedTtlSeconds = BOARD_IMAGE_SIGNED_TTL_SECONDS;

  async put(input: { storagePath: string; bytes: Uint8Array; mimeType: string }): Promise<void> {
    this.objects.set(input.storagePath, { bytes: input.bytes.slice(), mimeType: input.mimeType });
  }

  async get(storagePath: string): Promise<Uint8Array> {
    const found = this.objects.get(storagePath);
    if (!found) throw new BoardImageStorageConfigError("not found");
    return found.bytes.slice();
  }

  async remove(storagePath: string): Promise<void> {
    this.objects.delete(storagePath);
  }

  async sign(storagePath: string, expiresInSeconds = this.signedTtlSeconds): Promise<{ url: string; expiresAt: Date }> {
    if (!this.objects.has(storagePath)) throw new BoardImageStorageConfigError("not found");
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return { url: `memory://board-image/${encodeURIComponent(storagePath)}?exp=${expiresAt.getTime()}`, expiresAt };
  }

  publicObjectUrl(storagePath: string): string {
    return `memory://public/${storagePath}`;
  }
}

export class SupabaseBoardImageObjectStore implements BoardImageObjectStore {
  constructor(private readonly config: SupabaseStorageConfig) {}

  private objectUrl(storagePath: string): string {
    const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
    return `${this.config.supabaseUrl}/storage/v1/object/${this.config.bucket}/${encoded}`;
  }

  publicObjectUrl(storagePath: string): string {
    const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
    return `${this.config.supabaseUrl}/storage/v1/object/public/${this.config.bucket}/${encoded}`;
  }

  async ensurePrivateBucket(): Promise<void> {
    const list = await fetch(`${this.config.supabaseUrl}/storage/v1/bucket/${this.config.bucket}`, {
      headers: { Authorization: `Bearer ${this.config.serviceRoleKey}` },
    });
    if (list.ok) return;
    const created = await fetch(`${this.config.supabaseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: this.config.bucket,
        name: this.config.bucket,
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      }),
    });
    if (!created.ok && created.status !== 409) {
      const detail = await safeText(created);
      throw new BoardImageStorageConfigError(`Could not prepare private storage (${created.status}): ${detail}`);
    }
  }

  async put(input: { storagePath: string; bytes: Uint8Array; mimeType: string }): Promise<void> {
    await this.ensurePrivateBucket();
    const response = await fetch(this.objectUrl(input.storagePath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": input.mimeType,
        "x-upsert": "true",
        "cache-control": "private, max-age=0, no-store",
      },
      body: input.bytes.slice().buffer,
    });
    if (!response.ok) {
      throw new BoardImageStorageConfigError(`Upload failed (${response.status})`);
    }
  }

  async get(storagePath: string): Promise<Uint8Array> {
    const response = await fetch(this.objectUrl(storagePath), {
      headers: { Authorization: `Bearer ${this.config.serviceRoleKey}` },
    });
    if (!response.ok) throw new BoardImageStorageConfigError(`Read failed (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(storagePath: string): Promise<void> {
    const response = await fetch(this.objectUrl(storagePath), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.config.serviceRoleKey}` },
    });
    if (!response.ok && response.status !== 404 && response.status !== 400) {
      throw new BoardImageStorageConfigError(`Delete failed (${response.status})`);
    }
  }

  async sign(storagePath: string, expiresInSeconds = BOARD_IMAGE_SIGNED_TTL_SECONDS): Promise<{ url: string; expiresAt: Date }> {
    const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${this.config.supabaseUrl}/storage/v1/object/sign/${this.config.bucket}/${encoded}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!response.ok) throw new BoardImageStorageConfigError(`Sign failed (${response.status})`);
    const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
    const signed = body.signedURL ?? body.signedUrl;
    if (!signed) throw new BoardImageStorageConfigError("Sign failed");
    const url = signed.startsWith("http")
      ? signed
      : `${this.config.supabaseUrl}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "";
  }
}
