import { buildBitlink, normalizeBitlink } from "./normalizer.js";
import { logger } from "./logger.js";
import { LOG_DUPLICATE_BITLINK } from "./constants.js";

/**
 * BitlinkStore: wraps a Map for O(1) bitlink-to-longUrl lookups.
 * Single owner of normalization — normalizes on both write and read.
 */
export class BitlinkStore {
  private map = new Map<string, string>();

  /** Store a bitlink mapping. Logs a warning on duplicate (last-write-wins). */
  set(domain: string, hash: string, longUrl: string): void {
    const key = buildBitlink(domain, hash);
    const existing = this.map.get(key);
    if (existing !== undefined) {
      logger.warn({ key, existing, longUrl }, LOG_DUPLICATE_BITLINK);
    }
    this.map.set(key, longUrl);
  }

  /** Look up the long URL for a raw bitlink. Normalizes internally. */
  get(rawBitlink: string): string | undefined {
    return this.map.get(normalizeBitlink(rawBitlink));
  }

  /** Check if a raw bitlink exists in the store. Normalizes internally. */
  has(rawBitlink: string): boolean {
    return this.map.has(normalizeBitlink(rawBitlink));
  }

  get size(): number {
    return this.map.size;
  }
}
