/**
 * BitlinkStore: wraps a Map for O(1) bitlink-to-longUrl lookups.
 * Normalizes keys on write via buildBitlink.
 */
export class BitlinkStore {
  private map = new Map<string, string>();

  set(_domain: string, _hash: string, _longUrl: string): void {
    // TODO: implement
  }

  get(_normalizedBitlink: string): string | undefined {
    return undefined;
  }

  has(_normalizedBitlink: string): boolean {
    return false;
  }

  get size(): number {
    return this.map.size;
  }

  entries(): IterableIterator<[string, string]> {
    return this.map.entries();
  }
}
