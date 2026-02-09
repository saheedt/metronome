import { createReadStream } from "node:fs";
import { access, constants as fsConstants } from "node:fs/promises";
import path from "node:path";
import { parse as csvParse } from "csv-parse";
import StreamJson from "stream-json";
import StreamArray from "stream-json/streamers/StreamArray.js";
import {
  SUPPORTED_EXTENSIONS,
  LOG_SKIPPING_RECORD,
  errUnsupportedFormat,
  errMissingFields,
} from "./constants.js";
import { logger } from "./logger.js";

/**
 * Factory: file path + required fields -> validated AsyncIterable of objects.
 * Detects format by extension (.csv or .json) and streams records.
 */
export async function* createInputStream(
  filePath: string,
  requiredFields: readonly string[]
): AsyncIterable<Record<string, string>> {
  const ext = path.extname(filePath).toLowerCase();
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(errUnsupportedFormat(ext));
  }

  await access(filePath, fsConstants.R_OK);

  if (ext === ".csv") {
    yield* streamCsv(filePath, requiredFields);
  } else {
    yield* streamJson(filePath, requiredFields);
  }
}

async function* streamCsv(
  filePath: string,
  requiredFields: readonly string[]
): AsyncGenerator<Record<string, string>> {
  const csvStream = createReadStream(filePath, { encoding: "utf-8" }).pipe(
    csvParse({ columns: true, skip_empty_lines: true, trim: true })
  );

  let validated = false;
  let index = 0;
  for await (const record of csvStream) {
    if (!validated) {
      validateFields(record, requiredFields, filePath);
      validated = true;
    }
    const missing = requiredFields.filter((f) => !record[f]);
    if (missing.length > 0) {
      logger.warn({ index, missing }, LOG_SKIPPING_RECORD);
      index++;
      continue;
    }
    yield record;
    index++;
  }
}

async function* streamJson(
  filePath: string,
  requiredFields: readonly string[]
): AsyncGenerator<Record<string, string>> {
  const jsonStream = createReadStream(filePath, { encoding: "utf-8" })
    .pipe(StreamJson.parser())
    .pipe(StreamArray.streamArray());

  let validated = false;
  let index = 0;
  for await (const { value } of jsonStream) {
    if (!validated) {
      validateFields(value, requiredFields, filePath);
      validated = true;
    }
    const missing = requiredFields.filter((f) => !(f in value));
    if (missing.length > 0) {
      logger.warn({ index, missing }, LOG_SKIPPING_RECORD);
      index++;
      continue;
    }
    yield value;
    index++;
  }
}

/** Validates that the first record contains all required fields. */
function validateFields(
  record: Record<string, unknown>,
  requiredFields: readonly string[],
  filePath: string
): void {
  const keys = Object.keys(record);
  const missing = requiredFields.filter((f) => !keys.includes(f));
  if (missing.length > 0) {
    throw new Error(errMissingFields(filePath, missing, keys));
  }
}
