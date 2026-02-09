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
