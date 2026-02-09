import { describe, it, expect, vi, beforeEach } from "vitest";
import { BitlinkStore } from "../src/store.js";

vi.mock("../src/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("BitlinkStore", () => {
  let store: BitlinkStore;

  beforeEach(() => {
    store = new BitlinkStore();
    vi.clearAllMocks();
  });

  it("stores and retrieves a bitlink", () => {
    store.set("bit.ly", "31Tt55y", "https://google.com/");
    expect(store.get("bit.ly/31Tt55y")).toBe("https://google.com/");
  });

  it("get normalizes raw URL with protocol", () => {
    store.set("bit.ly", "31Tt55y", "https://google.com/");
    expect(store.get("http://bit.ly/31Tt55y")).toBe("https://google.com/");
  });

  it("has normalizes raw URL with protocol", () => {
    store.set("bit.ly", "31Tt55y", "https://google.com/");
    expect(store.has("http://bit.ly/31Tt55y")).toBe(true);
    expect(store.has("http://bit.ly/nope")).toBe(false);
  });

  it("returns undefined for unknown bitlinks", () => {
    expect(store.get("http://bit.ly/unknown")).toBeUndefined();
  });

  it("lowercases domain on set", () => {
    store.set("BIT.LY", "31Tt55y", "https://google.com/");
    expect(store.get("http://bit.ly/31Tt55y")).toBe("https://google.com/");
  });

  it("preserves hash case sensitivity", () => {
    store.set("bit.ly", "AbCdEf", "https://example.com/");
    expect(store.has("http://bit.ly/AbCdEf")).toBe(true);
    expect(store.has("http://bit.ly/abcdef")).toBe(false);
  });

  it("handles branded domain es.pn", () => {
    store.set("es.pn", "3MgVNnZ", "https://espn.com/");
    expect(store.get("http://es.pn/3MgVNnZ")).toBe("https://espn.com/");
  });

  it("handles branded domain amzn.to", () => {
    store.set("amzn.to", "3C5IIJm", "https://amazon.com/");
    expect(store.get("http://amzn.to/3C5IIJm")).toBe("https://amazon.com/");
  });

  it("reports correct size", () => {
    store.set("bit.ly", "aaa", "https://a.com/");
    store.set("bit.ly", "bbb", "https://b.com/");
    expect(store.size).toBe(2);
  });

  it("overwrites duplicate bitlink with last-write-wins and logs warning", async () => {
    const { logger } = await import("../src/logger.js");
    store.set("bit.ly", "31Tt55y", "https://google.com/");
    store.set("bit.ly", "31Tt55y", "https://other.com/");
    expect(store.get("http://bit.ly/31Tt55y")).toBe("https://other.com/");
    expect(store.size).toBe(1);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("stores multiple bitlinks for the same long URL as separate entries", () => {
    store.set("bit.ly", "aaa", "https://google.com/");
    store.set("bit.ly", "bbb", "https://google.com/");
    store.set("es.pn", "ccc", "https://google.com/");
    expect(store.size).toBe(3);
    expect(store.get("http://bit.ly/aaa")).toBe("https://google.com/");
    expect(store.get("http://bit.ly/bbb")).toBe("https://google.com/");
    expect(store.get("http://es.pn/ccc")).toBe("https://google.com/");
  });
});
