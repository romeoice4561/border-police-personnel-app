/**
 * HashGenerator
 *
 * Computes content hashes used for duplicate detection and incremental
 * sync comparisons. Interface-first: SHA-256 is the default algorithm; MD5
 * support is a named future extension point for providers/legacy systems
 * that expose an MD5 checksum instead of full content.
 */

import type { HashAlgorithm } from "@/lib/google-drive/drive_types";

/** Contract for a hash generator. Allows swapping in a real content-hashing backend later. */
export interface HashGenerator {
  algorithm: HashAlgorithm;
  /** Computes a hash for the given content buffer/bytes. */
  hash(content: Uint8Array): Promise<string>;
}

/**
 * Placeholder SHA-256 generator.
 *
 * Future extension point: implement using Node's `crypto` module (or a Web
 * Crypto equivalent) once real file bytes are available from a DriveClient
 * download. This phase has no network/file access, so this stub exists to
 * satisfy the interface and let dependent modules be type-checked and
 * tested against a fake.
 */
export class StubSha256HashGenerator implements HashGenerator {
  readonly algorithm: HashAlgorithm = "sha256";

  async hash(): Promise<string> {
    throw new Error("StubSha256HashGenerator.hash is not implemented in this phase");
  }
}

/**
 * Future extension point: MD5 support, e.g. for providers that only expose
 * an MD5 checksum (Drive API's `md5Checksum` field) without requiring a
 * full content download.
 */
export class StubMd5HashGenerator implements HashGenerator {
  readonly algorithm: HashAlgorithm = "md5";

  async hash(): Promise<string> {
    throw new Error("StubMd5HashGenerator.hash is not implemented in this phase");
  }
}
