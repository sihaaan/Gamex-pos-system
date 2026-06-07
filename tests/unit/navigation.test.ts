import { describe, expect, it } from "vitest";
import { visibleNavItems } from "@/lib/navigation";

describe("visibleNavItems", () => {
  it("shows only POS navigation for staff", () => {
    expect(visibleNavItems("STAFF").map((item) => item.label)).toEqual(["POS"]);
  });

  it("shows reports and admin for managers and owners", () => {
    expect(visibleNavItems("MANAGER").map((item) => item.label)).toEqual([
      "POS",
      "Reports",
      "Admin",
    ]);
    expect(visibleNavItems("OWNER").map((item) => item.label)).toEqual([
      "POS",
      "Reports",
      "Admin",
    ]);
  });
});
