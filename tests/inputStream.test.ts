import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { createInputStream } from "../src/inputStream.js";

vi.mock("../src/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const FIXTURES = path.resolve("tests/fixtures");

async function collect(
  iterable: AsyncIterable<Record<string, string>>
): Promise<Record<string, string>[]> {
  const records: Record<string, string>[] = [];
  for await (const record of iterable) {
    records.push(record);
  }
  return records;
}

describe("createInputStream", () => {
  describe("CSV parsing", () => {
    it("parses CSV into objects with correct keys", async () => {
      const records = await collect(
        createInputStream(path.join(FIXTURES, "small-encodes.csv"), [
          "long_url",
          "domain",
          "hash",
        ])
      );
      expect(records).toHaveLength(2);
      expect(records[0]).toHaveProperty("long_url", "https://google.com/");
      expect(records[0]).toHaveProperty("domain", "bit.ly");
      expect(records[0]).toHaveProperty("hash", "31Tt55y");
    });

    it("handles empty CSV (headers only)", async () => {
      const records = await collect(
        createInputStream(path.join(FIXTURES, "empty.csv"), [
          "long_url",
          "domain",
          "hash",
        ])
      );
      expect(records).toHaveLength(0);
    });

    it("rejects CSV with wrong headers", async () => {
      await expect(
        collect(
          createInputStream(path.join(FIXTURES, "bad-headers.csv"), [
            "long_url",
            "domain",
            "hash",
          ])
        )
      ).rejects.toThrow(/missing required fields/);
    });
  });

  describe("JSON parsing", () => {
    it("parses JSON array into objects with correct keys", async () => {
      const records = await collect(
        createInputStream(path.join(FIXTURES, "small-decodes.json"), [
          "bitlink",
          "timestamp",
        ])
      );
      expect(records).toHaveLength(3);
      expect(records[0]).toHaveProperty("bitlink", "http://bit.ly/31Tt55y");
      expect(records[0]).toHaveProperty("timestamp");
    });

    it("handles empty JSON array", async () => {
      const records = await collect(
        createInputStream(path.join(FIXTURES, "empty.json"), [
          "bitlink",
          "timestamp",
        ])
      );
      expect(records).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("throws on file not found", async () => {
      await expect(
        collect(
          createInputStream("/nonexistent/file.csv", ["a"])
        )
      ).rejects.toThrow();
    });

    it("throws on unsupported file extension", async () => {
      await expect(
        collect(
          createInputStream("data.xml", ["a"])
        )
      ).rejects.toThrow(/Unsupported file format/);
    });
  });
});
