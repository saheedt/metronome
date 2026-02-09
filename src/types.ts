/** A single row from the encodes file */
export interface EncodeRecord {
  long_url: string;
  domain: string;
  hash: string;
}

/** A single click event from the decodes file */
export interface DecodeRecord {
  bitlink: string;
  user_agent: string;
  timestamp: string;
  referrer: string;
  remote_ip: string;
}

/** A single result entry: { "https://google.com/": 492 } */
export type ClickCount = Record<string, number>;

/** CLI options parsed from argv */
export interface CliOptions {
  encodes: string;
  decodes: string;
  year: string;
}
