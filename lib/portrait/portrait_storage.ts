/**
 * PortraitStorage (Phase 24B-1).
 *
 * The seam between the portrait upload service and the object store that holds
 * the raw image bytes. Uploaded portraits are stored in Supabase Storage —
 * SYSTEM_CONTEXT.md lists Storage as a Supabase capability, and the project is
 * already Supabase-backed. Google Drive stays strictly READ-ONLY; nothing here
 * touches Drive.
 *
 * The interface is provider-agnostic and injectable so the upload service is
 * testable with an in-memory fake (no network). The concrete
 * SupabasePortraitStorage talks to the Supabase Storage REST API directly via
 * fetch (no new SDK dependency), authenticated with the service-role key —
 * server-only, never exposed to the client.
 */

/** A stored object: the storage path plus its public + thumbnail URLs. */
export interface StoredPortrait {
  /** Object path within the bucket (e.g. "officers/ภาค1-5/uuid.jpg"). */
  storagePath: string;
  /** Publicly resolvable URL for the stored object. */
  publicUrl: string;
  /** A render-sized URL (Supabase image transform when available; else the public URL). */
  thumbnailUrl: string;
}

export interface PutPortraitInput {
  storagePath: string;
  bytes: Uint8Array;
  mimeType: string;
}

/** Contract every portrait object-store implementation must satisfy. */
export interface PortraitStorage {
  /** Uploads (or overwrites) an object and returns its stored URLs. */
  put(input: PutPortraitInput): Promise<StoredPortrait>;
  /**
   * Removes a stored object (used to roll back a failed upload). Best-effort:
   * a missing object is not an error. Never throws for "not found".
   */
  remove(storagePath: string): Promise<void>;
}

export class PortraitStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortraitStorageConfigError";
  }
}

export interface SupabaseStorageConfig {
  /** Supabase project URL, e.g. https://<ref>.supabase.co */
  supabaseUrl: string;
  /** Service-role key (server-only). */
  serviceRoleKey: string;
  /** Bucket name (defaults to "portraits"). */
  bucket: string;
}

/**
 * Resolves Supabase Storage config from the environment. Returns null (rather
 * than throwing) when the required variables are absent, so callers can degrade
 * gracefully with a clear "storage not configured" message — matching the
 * existing "feature" env-var pattern (Drive/OCR behave the same way).
 *
 * SUPABASE_URL is taken from NEXT_PUBLIC_SUPABASE_URL when set, else derived
 * from the DATABASE_URL host (db.<ref>.supabase.co → https://<ref>.supabase.co).
 */
export function resolveSupabaseStorageConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseStorageConfig | null {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;

  const supabaseUrl = resolveSupabaseUrl(env);
  if (!supabaseUrl) return null;

  const bucket = env.SUPABASE_PORTRAIT_BUCKET?.trim() || "portraits";
  return { supabaseUrl, serviceRoleKey, bucket };
}

/** Derives the Supabase project URL from the explicit env var or the DATABASE_URL host. */
export function resolveSupabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const dbUrl = env.DATABASE_URL?.trim() || env.DIRECT_URL?.trim();
  if (!dbUrl) return null;
  // Match a Supabase host: db.<ref>.supabase.co OR <ref>.pooler.supabase.com
  const ref =
    /(?:db\.)([a-z0-9]+)\.supabase\.co/i.exec(dbUrl)?.[1] ??
    /postgres\.([a-z0-9]+):/i.exec(dbUrl)?.[1] ??
    /@([a-z0-9]+)\.pooler\.supabase\.com/i.exec(dbUrl)?.[1];
  return ref ? `https://${ref}.supabase.co` : null;
}

/** Supabase Storage-backed PortraitStorage over the REST API (no SDK dependency). */
export class SupabasePortraitStorage implements PortraitStorage {
  constructor(private readonly config: SupabaseStorageConfig) {}

  private objectUrl(storagePath: string): string {
    const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
    return `${this.config.supabaseUrl}/storage/v1/object/${this.config.bucket}/${encoded}`;
  }

  private publicUrl(storagePath: string): string {
    const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
    return `${this.config.supabaseUrl}/storage/v1/object/public/${this.config.bucket}/${encoded}`;
  }

  async put(input: PutPortraitInput): Promise<StoredPortrait> {
    const response = await fetch(this.objectUrl(input.storagePath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "Content-Type": input.mimeType,
        // Overwrite if the deterministic path already exists (idempotent retry).
        "x-upsert": "true",
        "cache-control": "3600",
      },
      // Send a fresh ArrayBuffer copy so the fetch BodyInit type is unambiguous.
      body: input.bytes.slice().buffer,
    });

    if (!response.ok) {
      const detail = await safeText(response);
      throw new PortraitStorageConfigError(
        `Supabase Storage upload failed (${response.status}): ${detail}. ` +
          "Verify SUPABASE_SERVICE_ROLE_KEY and that the bucket exists."
      );
    }

    const publicUrl = this.publicUrl(input.storagePath);
    // Supabase render endpoint returns a resized image when the transform
    // add-on is enabled; it degrades to the public URL otherwise. Use a square
    // thumbnail sized for the avatar/list.
    const encoded = input.storagePath.split("/").map(encodeURIComponent).join("/");
    const thumbnailUrl = `${this.config.supabaseUrl}/storage/v1/render/image/public/${this.config.bucket}/${encoded}?width=256&height=256&resize=cover`;

    return { storagePath: input.storagePath, publicUrl, thumbnailUrl };
  }

  async remove(storagePath: string): Promise<void> {
    const response = await fetch(this.objectUrl(storagePath), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.config.serviceRoleKey}` },
    });
    // 404/400 on an already-absent object is fine for rollback semantics.
    if (!response.ok && response.status !== 404 && response.status !== 400) {
      const detail = await safeText(response);
      throw new PortraitStorageConfigError(
        `Supabase Storage delete failed (${response.status}): ${detail}.`
      );
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "<no body>";
  }
}
