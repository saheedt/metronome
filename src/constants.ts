export const DEFAULT_ENCODES_PATH = "data/encodes.csv";
export const DEFAULT_DECODES_PATH = "data/decodes.json";
export const DEFAULT_YEAR = "2021";

export const SUPPORTED_EXTENSIONS = [".csv", ".json"] as const;

export const ENCODE_REQUIRED_FIELDS = ["long_url", "domain", "hash"] as const;
export const DECODE_REQUIRED_FIELDS = ["bitlink", "timestamp"] as const;

export const YEAR_PATTERN = /^\d{4}$/;

export const EXIT_SUCCESS = 0;
export const EXIT_INPUT_ERROR = 1;
export const EXIT_RUNTIME_ERROR = 2;

// --- Log messages (static) ---

export const LOG_LOADING_ENCODES = "Loading encodes";
export const LOG_ENCODES_LOADED = "Encodes loaded";
export const LOG_LOADING_DECODES = "Loading decodes";
export const LOG_DECODE_COMPLETE = "Decode processing complete";
export const LOG_DUPLICATE_BITLINK = "Duplicate bitlink: overwriting mapping";
export const LOG_SKIPPING_RECORD = "Skipping record with missing fields";
export const LOG_NO_ENCODES_LOADED = "No encodes loaded, skipping decode processing";
export const LOG_SKIPPING_UNSUPPORTED_TIMESTAMP = "Skipping record with unsupported timestamp format";
export const LOG_SKIPPING_NO_LONG_URL = "Skipping record without long url to aggregate on";

// --- Error messages ---

export const ERR_INVALID_YEAR = "Invalid year format. Expected 4-digit year (e.g., 2021)";
export const ERR_FILE_NOT_FOUND = "File not found";
export const ERR_PROCESSING_FAILED = "Processing failed";
export const ERR_UNEXPECTED = "Unexpected error";

export const errUnsupportedFormat = (ext: string): string =>
  `Unsupported file format: ${ext}. Only ${SUPPORTED_EXTENSIONS.join(", ")} files are supported.`;

export const errMissingFields = (filePath: string, missing: string[], found: string[]): string =>
  `File ${filePath} is missing required fields: [${missing.join(", ")}]. Found: [${found.join(", ")}]`;

export const errFileSyntax = (fileType: string, filePath: string, message: string) => `${fileType} Syntax Error in file '${filePath}': ${message}`;
