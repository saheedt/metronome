import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { processClicks } from "../src/processor.js";

vi.mock("../src/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const FIXTURES = path.resolve("tests/fixtures");

describe("processClicks", () => {
  it("counts clicks per long URL for a given year", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2021",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "https://google.com/": 2 });
    expect(result[1]).toEqual({ "https://github.com/": 1 });
  });

  it("returns results sorted descending by count", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2021",
    });

    const counts = result.map((entry) => Object.values(entry)[0]);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it("returns zero counts for URLs with no clicks in the target year", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2020",
    });

    expect(result).toHaveLength(2);
    result.forEach((entry) => {
      expect(Object.values(entry)[0]).toBe(0);
    });
  });

  it("skips unmatched bitlinks silently", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "decodes-with-unmatched.json"),
      year: "2021",
    });

    const urls = result.map((entry) => Object.keys(entry)[0]);
    expect(urls).toContain("https://google.com/");
    expect(urls).toContain("https://github.com/");
    expect(urls).not.toContain("es.pn/3MgVNnZ");
  });

  it("handles empty encodes", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "empty.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2021",
    });

    expect(result).toEqual([]);
  });

  it("handles empty decodes", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "empty.json"),
      year: "2021",
    });

    expect(result).toHaveLength(2);
    result.forEach((entry) => {
      expect(Object.values(entry)[0]).toBe(0);
    });
  });

  it("handles boundary timestamps correctly", async () => {
    const result = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2021",
    });

    // 2021-01-01T00:00:00Z should be included (starts with "2021")
    const googleCount = Object.values(result.find(
      (r) => Object.keys(r)[0] === "https://google.com/"
    )!)[0];
    expect(googleCount).toBeGreaterThan(0);
  });

  it("works with different year values", async () => {
    const result2022 = await processClicks({
      encodesPath: path.join(FIXTURES, "small-encodes.csv"),
      decodesPath: path.join(FIXTURES, "small-decodes.json"),
      year: "2022",
    });

    result2022.forEach((entry) => {
      expect(Object.values(entry)[0]).toBe(0);
    });
  });

  it("produces correct output for real data with year 2021", async () => {
    const result = await processClicks({
      encodesPath: path.resolve("data/encodes.csv"),
      decodesPath: path.resolve("data/decodes.json"),
      year: "2021",
    });

    expect(result).toEqual([
      { "https://youtube.com/": 557 },
      { "https://twitter.com/": 512 },
      { "https://reddit.com/": 510 },
      { "https://github.com/": 497 },
      { "https://linkedin.com/": 496 },
      { "https://google.com/": 492 },
    ]);
  });
});
