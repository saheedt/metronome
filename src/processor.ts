import type { ClickCount } from "./types.js";

export interface ProcessOptions {
  encodesPath: string;
  decodesPath: string;
  year: string;
}

/**
 * Load encodes, stream decodes, filter by year, count clicks per long URL.
 * Returns sorted array of {longUrl: count} descending by count.
 */
export async function processClicks(_options: ProcessOptions): Promise<ClickCount[]> {
  // TODO: implement
  return [];
}
