/**
 * Factory: file path + required fields -> validated AsyncIterable of objects.
 * Detects format by extension (.csv or .json) and streams records.
 */
export async function* createInputStream(
  _filePath: string,
  _requiredFields: readonly string[]
): AsyncIterable<Record<string, string>> {
  // TODO: implement
}
