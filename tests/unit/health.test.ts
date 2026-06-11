import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("health endpoint", () => {
  it("returns OK", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "ok",
      service: "gamex-pos",
    });
    expect(typeof payload.timestamp).toBe("string");
  });
});
