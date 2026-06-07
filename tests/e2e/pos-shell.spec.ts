import { expect, test } from "@playwright/test";

test("POS route renders the application shell", async ({ page }) => {
  await page.goto("/pos");
  await expect(page.getByRole("link", { name: "GameX POS" })).toBeVisible();
});
