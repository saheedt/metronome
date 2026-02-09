import { describe, it, expect } from "vitest";
import { normalizeBitlink, buildBitlink } from "../src/normalizer.js";

describe("normalizeBitlink", () => {
  it("strips http:// protocol", () => {
    expect(normalizeBitlink("http://bit.ly/31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("strips https:// protocol", () => {
    expect(normalizeBitlink("https://bit.ly/31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("lowercases domain but preserves hash case", () => {
    expect(normalizeBitlink("http://BIT.LY/31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("handles already-normalized input", () => {
    expect(normalizeBitlink("bit.ly/31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("handles branded domain es.pn", () => {
    expect(normalizeBitlink("http://es.pn/3MgVNnZ")).toBe("es.pn/3MgVNnZ");
  });

  it("handles branded domain amzn.to", () => {
    expect(normalizeBitlink("http://amzn.to/3C5IIJm")).toBe("amzn.to/3C5IIJm");
  });

  it("strips trailing slash from hash", () => {
    expect(normalizeBitlink("http://bit.ly/31Tt55y/")).toBe("bit.ly/31Tt55y");
  });

  it("handles domain-only input with no hash", () => {
    expect(normalizeBitlink("http://BIT.LY")).toBe("bit.ly");
  });

  it("handles empty string", () => {
    expect(normalizeBitlink("")).toBe("");
  });
});

describe("buildBitlink", () => {
  it("builds normalized key from domain and hash", () => {
    expect(buildBitlink("bit.ly", "31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("lowercases domain", () => {
    expect(buildBitlink("BIT.LY", "31Tt55y")).toBe("bit.ly/31Tt55y");
  });

  it("preserves hash case", () => {
    expect(buildBitlink("bit.ly", "AbCdEf")).toBe("bit.ly/AbCdEf");
  });

  it("handles branded domains", () => {
    expect(buildBitlink("es.pn", "3MgVNnZ")).toBe("es.pn/3MgVNnZ");
  });

  it("strips protocol from domain if present", () => {
    expect(buildBitlink("http://bit.ly", "abc")).toBe("bit.ly/abc");
  });
});
