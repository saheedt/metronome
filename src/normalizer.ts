/**
 * Normalize a raw bitlink URL to canonical form: "domain/hash".
 * Strips protocol (http://, https://), lowercases domain, preserves hash case.
 */
export function normalizeBitlink(raw: string): string {
  const stripped = raw.replace(/^https?:\/\//, "");
  const slashIndex = stripped.indexOf("/");

  if (slashIndex === -1) {
    return stripped.toLowerCase();
  }

  const domain = stripped.slice(0, slashIndex).toLowerCase();
  const hash = stripped.slice(slashIndex + 1).replace(/\/$/, "");

  return `${domain}/${hash}`;
}

/**
 * Build a normalized bitlink key from separate domain and hash components.
 * Routes through normalizeBitlink so set and get use identical transformation.
 */
export function buildBitlink(domain: string, hash: string): string {
  return normalizeBitlink(`${domain}/${hash}`);
}
