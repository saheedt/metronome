import { createReadStream } from 'node:fs';
import { access, constants as fsConstants } from 'node:fs/promises';
import path from 'node:path';
import { parse as csvParse } from 'csv-parse';
import StreamJson from 'stream-json';
import StreamArray from 'stream-json/streamers/StreamArray.js';
import {
	SUPPORTED_EXTENSIONS,
	LOG_SKIPPING_RECORD,
	errUnsupportedFormat,
	errMissingFields,
	errFileSyntax,
} from './constants.js';
import { logger } from './logger.js';

/**
 * Factory: file path + required fields -> validated AsyncIterable of objects.
 * Detects format by extension (.csv or .json) and streams records.
 */
export async function* createInputStream(
	filePath: string,
	requiredFields: readonly string[],
): AsyncIterable<Record<string, string>> {
	const ext = path.extname(filePath).toLowerCase();
	if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
		throw new Error(errUnsupportedFormat(ext));
	}

	await access(filePath, fsConstants.R_OK);

	if (ext === '.csv') {
		yield* streamCsv(filePath, requiredFields);
	} else {
		yield* streamJson(filePath, requiredFields);
	}
}

async function* streamCsv(
	filePath: string,
	requiredFields: readonly string[],
): AsyncGenerator<Record<string, string>> {
	const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
	const parser = csvParse({
		columns: true,
		skip_empty_lines: true,
		trim: true,
	});

	fileStream.pipe(parser);

	fileStream.on('error', (error) => parser.destroy(error));

	let validated = false;
	let index = 0;

	try {
		// If 'parser' errors (itself or via forwarding), this loop throws.
		for await (const record of parser) {
			if (!validated) {
				validateFields(record, requiredFields, filePath);
				validated = true;
			}
			const missing = requiredFields.filter((f) => !(f in record));
			if (missing.length > 0) {
				logger.warn({ index, missing }, LOG_SKIPPING_RECORD);
				index++;
				continue;
			}
			yield record;
			index++;
		}
	} catch (error) {
		if (error instanceof Error && 'code' in error) {
			throw new Error(errFileSyntax('CSV', filePath, error.message));
		}
		throw error;
	}
}

async function* streamJson(
	filePath: string,
	requiredFields: readonly string[],
): AsyncGenerator<Record<string, string>> {
	const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
	const parser = StreamJson.parser();
	const streamArray = StreamArray.streamArray();

	fileStream.pipe(parser).pipe(streamArray);

	// CRITICAL: Forward upstream errors to the final stream.
	// If 'fileStream' or 'parser' fails, we destroy 'streamArray' with that error.
	// This causes the loop below to throw the error, allowing us to catch it.
	const forwardError = (error: Error) => streamArray.destroy(error);
	fileStream.on('error', forwardError);
	parser.on('error', forwardError);

	let validated = false;
	let index = 0;

	try {
		for await (const { value } of streamArray) {
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
	} catch (error) {
		if (error instanceof Error) {
			const isParserError =
				error.message.includes('Unexpected token') ||
				error.message.includes('Parser has expected') ||
				error.message.includes('Unexpected end of');

			if (isParserError)
				throw new Error(errFileSyntax('JSON', filePath, error.message));
		}
		throw error;
	}
}

/** Validates that the first record contains all required fields. */
function validateFields(
	record: Record<string, unknown>,
	requiredFields: readonly string[],
	filePath: string,
): void {
	const keys = Object.keys(record);
	const missing = requiredFields.filter((f) => !keys.includes(f));
	if (missing.length > 0) {
		throw new Error(errMissingFields(filePath, missing, keys));
	}
}
