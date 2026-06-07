import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("offline policy", () => {
  it("does not cache or replay API writes through the service worker", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain('url.pathname.startsWith("/api/")');
  });
});
