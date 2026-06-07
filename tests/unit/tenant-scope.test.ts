import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/http";
import { assertLegalEntityScope, tenantWhere } from "@/lib/permissions/tenant";

describe("tenant scope", () => {
  it("adds legal_entity_id to query filters", () => {
    expect(tenantWhere("entity-a", { status: "OPEN" })).toEqual({
      legalEntityId: "entity-a",
      status: "OPEN",
    });
  });

  it("prevents cross-legal-entity access", () => {
    expect(() =>
      assertLegalEntityScope("entity-a", {
        legalEntityId: "entity-b",
        branchId: "branch-b",
      }),
    ).toThrow(AppError);
  });
});
