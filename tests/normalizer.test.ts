import { describe, it, expect } from "vitest";
import { normalizeBitlink, buildBitlink } from "../src/normalizer.js";

describe("normalizeBitlink", () => {
  it.todo("strips http:// protocol");
  it.todo("strips https:// protocol");
  it.todo("lowercases domain but preserves hash case");
  it.todo("handles branded domains");
  it.todo("handles already-normalized input");
  it.todo("strips trailing slash");
});

describe("buildBitlink", () => {
  it.todo("builds from domain and hash");
  it.todo("lowercases domain");
});
