import { BitlinkStore } from './store.js';
import { createInputStream } from './inputStream.js';
import { logger } from './logger.js';
import {
	ENCODE_REQUIRED_FIELDS,
	DECODE_REQUIRED_FIELDS,
	LOG_LOADING_ENCODES,
	LOG_ENCODES_LOADED,
	LOG_LOADING_DECODES,
	LOG_DECODE_COMPLETE,
	LOG_NO_ENCODES_LOADED,
  LOG_SKIPPING_UNSUPPORTED_TIMESTAMP,
  LOG_SKIPPING_NO_LONG_URL,
} from './constants.js';
import type { ClickCount } from './types.js';

export interface ProcessOptions {
	encodesPath: string;
	decodesPath: string;
	year: string;
}

/**
 * Load encodes, stream decodes, filter by year, count clicks per long URL.
 * Returns sorted array of {longUrl: count} descending by count.
 */
export async function processClicks(
	options: ProcessOptions,
): Promise<ClickCount[]> {
	const { encodesPath, decodesPath, year } = options;

	const store = new BitlinkStore();
	const clickCounts = new Map<string, number>();

	logger.info({ path: encodesPath }, LOG_LOADING_ENCODES);

	for await (const record of createInputStream(
		encodesPath,
		ENCODE_REQUIRED_FIELDS,
	)) {
		const { long_url, domain, hash } = record;
		store.set(domain, hash, long_url);
		// Initialize zero-count for each unique long URL
		if (!clickCounts.has(long_url)) {
			clickCounts.set(long_url, 0);
		}
	}

	if (store.size === 0) {
		logger.info(LOG_NO_ENCODES_LOADED);
		return [];
	}

	logger.info(
		{ encodes: store.size, uniqueUrls: clickCounts.size },
		LOG_ENCODES_LOADED,
	);

	let processed = 0;
	let matched = 0;

	logger.info({ path: decodesPath }, LOG_LOADING_DECODES);

	for await (const record of createInputStream(
		decodesPath,
		DECODE_REQUIRED_FIELDS,
	)) {
		processed++;
		const { bitlink, timestamp } = record;

		if (!timestamp.startsWith(year)) {
      logger.warn({ bitlink, timestamp }, LOG_SKIPPING_UNSUPPORTED_TIMESTAMP);
			continue;
		}

		const longUrl = store.get(bitlink);

		if (!longUrl) {
      logger.warn({ bitlink, timestamp }, LOG_SKIPPING_NO_LONG_URL);
			continue;
		}

		matched++;
		clickCounts.set(longUrl, (clickCounts.get(longUrl) ?? 0) + 1);
	}

	logger.info({ processed, matched, year }, LOG_DECODE_COMPLETE);

	const result: ClickCount[] = Array.from(clickCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([url, count]) => ({ [url]: count }));

	return result;
}
