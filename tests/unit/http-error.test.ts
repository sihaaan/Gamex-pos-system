import { afterEach, describe, expect, it, vi } from "vitest";
import { errorResponse } from "@/lib/http";

describe("API error responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not leak stack traces or secret values for unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = errorResponse(
      new Error("database password is super-secret-value"),
    );
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(payload.error.message).toBe(
      "Something went wrong while processing the request.",
    );
    expect(typeof payload.error.requestId).toBe("string");
    expect(serialized).not.toContain("super-secret-value");
    expect(serialized).not.toContain("Error:");
  });
});
