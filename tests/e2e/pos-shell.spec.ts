import "dotenv/config";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { Client } from "pg";

const E2E_PREFIX = "E2E Staff Flow";
const AUTOMATION_CLEANUP_PREFIXES = [
  E2E_PREFIX,
  "UI Timing Smoke",
  "Timing card smoke",
  "Open bill same-click",
];
const STAFF_EMAIL = "ag-staff@gamex.local";
const MANAGER_EMAIL = "ag-manager@gamex.local";
const STAFF_PASSWORD = "Gamex@12345";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await cleanupE2eBills();
  await loginAsStaff(page);
  await openShiftIfNeeded(page);
});

test.afterEach(async () => {
  await cleanupE2eBills();
});

test("full staff sale posts Pool, PS5, snack, PhonePe payment, invoice, and shift summary", async ({
  page,
}) => {
  const billLabel = uniqueBillLabel("Full sale");

  await startPoolFromEmptySelection(page, billLabel);
  await addPs5ToSelectedBill(page, billLabel);
  await addChips(page);
  await pauseAndResumePool(page);
  await stopGame(page, "Pool table timed play", "Pool 1");
  await stopGame(page, "PS5 console timed play", "PS5 1");
  await applySmallDiscount(page);
  await payWithPhonePeAndPostCheckout(page);

  await expect(page.getByText("Invoice posted")).toBeVisible();
  await expect(
    page.getByText("Create or select a customer bill to start selling."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open invoice" }).click();
  await page.waitForURL("**/invoices/**");
  await expect(page.getByText("Pool play - 10 min")).toBeVisible();
  await expect(page.getByText("PS5 play - 10 min")).toBeVisible();
  await expect(page.getByText("Chips pack x1")).toBeVisible();
  await expect(page.getByText("UPI - PhonePe", { exact: true })).toBeVisible();
  await expect(page.getByText("GST Tax Invoice")).toBeVisible();
  await expect(page.getByText("Final total")).toBeVisible();
  await expect(page.getByText("Discount")).toBeVisible();
  await expect(page.getByText("Paid")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("MIN_10_ROUND");
  await expect(page.getByRole("button", { name: "Print invoice" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Receipt view" })).toBeVisible();

  await page.getByRole("link", { name: "Receipt view" }).click();
  await expect(page.getByText("Thank you for playing")).toBeVisible();
  await expect(page.getByText("Pool play - 10 min")).toBeVisible();
  await expect(page.getByText("PS5 play - 10 min")).toBeVisible();
  await expect(page.getByText("Chips pack x1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print receipt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GST invoice" })).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Back to POS" }).click();
  await page.waitForURL("**/pos");
  await expect(
    page.getByText("Create or select a customer bill to start selling."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Close operator shift" }).click();
  await expect(page.getByText("Shift closed.")).toBeVisible();
  await expect(page.getByText("Shift summary")).toBeVisible();
  await expect(page.getByText("No open tabs")).toBeVisible();
  await expect(page.getByText("PhonePe")).toBeVisible();
});

test("checkout stays visibly blocked while a game is running", async ({ page }) => {
  const billLabel = uniqueBillLabel("Running block");

  await startPoolFromEmptySelection(page, billLabel);

  await expect(
    page.getByText("Estimate only — stop games for final bill."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop games to checkout" }),
  ).toBeDisabled();
  await expect(
    page.locator("aside").getByText("Stop running games before checkout."),
  ).toHaveCount(2);
});

test("selected bill and payment state clear after checkout", async ({ page }) => {
  const billLabel = uniqueBillLabel("Clear selected");

  await startPoolFromEmptySelection(page, billLabel);
  await stopGame(page, "Pool table timed play", "Pool 1");
  await payWithPhonePeAndPostCheckout(page);

  await expect(page.getByText("Invoice posted")).toBeVisible();
  await expect(
    page.getByText("Create or select a customer bill to start selling."),
  ).toBeVisible();
  await expect(page.getByText("Payment matched")).toHaveCount(0);
  await expect(page.locator("aside").getByText(billLabel)).toHaveCount(0);
});

test("shift close is blocked while open bills exist and closes cleanly after cleanup", async ({
  page,
}) => {
  const billLabel = uniqueBillLabel("Shift safety");

  await createOpenBill(page, billLabel);
  await page.getByRole("button", { name: "Close operator shift" }).click();
  await expect(page.getByText("Close blocked: finish checkout or void 1 open bill before closing shift.")).toBeVisible();

  await cleanupE2eBills();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Close operator shift" }).click();
  await expect(page.getByText("Shift closed.")).toBeVisible();
  await expect(page.getByText("Shift summary")).toBeVisible();
});

test("release candidate fake day covers mixed tender, shift close, reports, and CSV exports", async ({
  page,
}) => {
  const poolOnlyBill = uniqueBillLabel("RC pool PhonePe");
  await startPoolFromEmptySelection(page, poolOnlyBill);
  await stopGame(page, "Pool table timed play", "Pool 1");
  await payWithPhonePeAndPostCheckout(page);
  await expect(page.getByText("Invoice posted")).toBeVisible();

  const mixedBill = uniqueBillLabel("RC pool PS5 chips mixed");
  await startPoolFromEmptySelection(page, mixedBill);
  await addPs5ToSelectedBill(page, mixedBill);
  await addChips(page);
  await stopGame(page, "Pool table timed play", "Pool 1");
  await stopGame(page, "PS5 console timed play", "PS5 1");
  await payWithCashAndPhonePeAndPostCheckout(page);
  await expect(page.getByText("Invoice posted")).toBeVisible();

  await page.getByRole("link", { name: "Open invoice" }).click();
  await page.waitForURL("**/invoices/**");
  await expect(page.getByText("GST Tax Invoice")).toBeVisible();
  await expect(page.getByText("Pool play - 10 min")).toBeVisible();
  await expect(page.getByText("PS5 play - 10 min")).toBeVisible();
  await expect(page.getByText("Chips pack x1")).toBeVisible();
  await expect(page.getByText("Cash", { exact: true })).toBeVisible();
  await expect(page.getByText("UPI - PhonePe", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Receipt view" }).click();
  await expect(page.getByText("Thank you for playing")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Back to POS" }).click();
  await page.waitForURL("**/pos");

  const ps5PauseBill = uniqueBillLabel("RC PS5 pause");
  await startResourceFromEmptySelection(page, "PS5 1", "PS5", ps5PauseBill);
  await pauseAndResumePs5(page);
  await stopGame(page, "PS5 console timed play", "PS5 1");
  await payWithPhonePeAndPostCheckout(page);
  await expect(page.getByText("Invoice posted")).toBeVisible();

  const snackOnlyBill = uniqueBillLabel("RC snacks");
  await createOpenBill(page, snackOnlyBill);
  await addChips(page);
  await payWithPhonePeAndPostCheckout(page);
  await expect(page.getByText("Invoice posted")).toBeVisible();

  await page.getByRole("button", { name: "Close operator shift" }).click();
  await expect(page.getByText("Shift closed.")).toBeVisible();
  await expect(page.getByText("Shift summary")).toBeVisible();
  await expect(page.getByText("No open tabs")).toBeVisible();
  await expect(page.getByText("PhonePe")).toBeVisible();
  await expect(page.getByText("Cash")).toBeVisible();

  await logout(page);
  await login(page, MANAGER_EMAIL, STAFF_PASSWORD, "**/pos");
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Loading reports...")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sales" })).toBeVisible();

  for (const reportTab of [
    { button: "Tenders", heading: "Tenders" },
    { button: "GST / CA", heading: "GST / CA export" },
    { button: "Shifts", heading: "Shifts" },
    { button: "Exceptions", heading: "Exceptions" },
    { button: "Resources", heading: "Resource utilization" },
    { button: "Products", heading: "Product sales" },
    { button: "Exports", heading: "Exports" },
  ]) {
    await page.getByRole("button", { name: reportTab.button }).click();
    await expect(
      page.getByRole("heading", { name: reportTab.heading }),
    ).toBeVisible();
  }

  const tenderCsv = await page.request.get("/api/reports/tenders?preset=today&format=csv");
  expect(tenderCsv.ok()).toBe(true);
  expect(tenderCsv.headers()["content-type"]).toContain("text/csv");
  expect(tenderCsv.headers()["content-disposition"]).toContain("tender-report.csv");
  await expectCsvText(tenderCsv, ["Invoice Number", "UPI - PhonePe", "Cash"]);

  const gstCsv = await page.request.get("/api/reports/gst?preset=today&format=csv");
  expect(gstCsv.ok()).toBe(true);
  expect(gstCsv.headers()["content-type"]).toContain("text/csv");
  expect(gstCsv.headers()["content-disposition"]).toContain("gst-invoice-rows.csv");
  await expectCsvText(gstCsv, ["Invoice Number", "Customer/Bill", "Total GST"]);
});

async function loginAsStaff(page: Page): Promise<void> {
  await login(page, STAFF_EMAIL, STAFF_PASSWORD, "**/pos");
}

async function login(
  page: Page,
  email: string,
  password: string,
  expectedUrl: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(expectedUrl);
  await expect(page.getByRole("link", { name: "GameX POS" })).toBeVisible();
}

async function logout(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/logout");
  expect(response.ok()).toBe(true);
  await page.goto("/login");
}

async function openShiftIfNeeded(page: Page): Promise<void> {
  const closeShift = page.getByRole("button", { name: "Close operator shift" });
  if (
    await closeShift
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    return;
  }

  const openShift = page.getByRole("button", { name: "Open shift" });
  await expect(openShift).toBeVisible();
  await openShift.click();
  await expect(closeShift).toBeVisible();
}

async function startPoolFromEmptySelection(
  page: Page,
  billLabel: string,
): Promise<void> {
  await startResourceFromEmptySelection(page, "Pool 1", "Pool", billLabel);
}

async function startResourceFromEmptySelection(
  page: Page,
  resourceName: string,
  playLabel: "Pool" | "PS5",
  billLabel: string,
): Promise<void> {
  await expect(
    page.getByText("Create or select a customer bill to start selling."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Start ${playLabel} play on ${resourceName}` })
    .click();
  const dialog = page.getByRole("dialog", {
    name: `Start play on ${resourceName}`,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Customer / table name").fill(billLabel);
  await dialog.getByRole("button", { name: "Start play" }).click();
  await expect(
    page.getByText(`${resourceName} added to ${billLabel}.`),
  ).toBeVisible();
  await expectSelectedBill(page, billLabel);
}

async function createOpenBill(page: Page, billLabel: string): Promise<void> {
  await page.getByLabel("Customer / table").fill(billLabel);
  await page.getByRole("button", { name: "New bill" }).click();
  await expect(page.getByText(`${billLabel} created.`)).toBeVisible();
  await expectSelectedBill(page, billLabel);
}

async function addPs5ToSelectedBill(
  page: Page,
  billLabel: string,
): Promise<void> {
  await page.getByRole("button", { name: "Start PS5 play on PS5 1" }).click();
  await expect(page.getByText(`PS5 1 added to ${billLabel}.`)).toBeVisible();
}

async function addChips(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Chips pack/ }).click();
  await expect(page.getByText("Snack or drink added.")).toBeVisible();
}

async function pauseAndResumePool(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Pause Pool table timed play on Pool 1" })
    .click();
  await expect(page.getByText("Game paused.")).toBeVisible();
  await page
    .getByRole("button", { name: "Resume Pool table timed play on Pool 1" })
    .click();
  await expect(page.getByText("Game resumed.")).toBeVisible();
}

async function pauseAndResumePs5(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Pause PS5 console timed play on PS5 1" })
    .click();
  await expect(page.getByText("Game paused.")).toBeVisible();
  await page
    .getByRole("button", { name: "Resume PS5 console timed play on PS5 1" })
    .click();
  await expect(page.getByText("Game resumed.")).toBeVisible();
}

async function stopGame(
  page: Page,
  description: string,
  resourceName: string,
): Promise<void> {
  const stopButton = page.getByRole("button", {
    name: `Stop ${description} on ${resourceName}`,
  });
  await stopButton.click();
  await expect(
    page.getByText(
      `Tap Confirm stop on ${resourceName} to end billing for that game.`,
    ),
  ).toBeVisible();
  await stopButton.click();
  await expect(page.getByText("Game stopped.")).toBeVisible();
}

async function applySmallDiscount(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add discount" }).click();
  await page.getByLabel("Value").fill("10");
  await page.getByLabel("Discount reason").fill("Staff goodwill");
  await expect(page.getByText("Discount -₹10.00")).toBeVisible();
  await expect(page.getByText("Manual -₹10.00 - Staff goodwill")).toBeVisible();
}

async function payWithPhonePeAndPostCheckout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Use bill total" }).click();
  await expect(page.getByText("Payment updated to")).toBeVisible();
  await expect(page.getByText("Payment matched")).toBeVisible();
  const postCheckout = page.getByRole("button", { name: "Post checkout" });
  await expect(postCheckout).toBeEnabled();
  await postCheckout.click();
}

async function payWithCashAndPhonePeAndPostCheckout(page: Page): Promise<void> {
  const firstTender = page.getByLabel("Tender 1", { exact: true });
  await expect(firstTender).toBeEnabled();
  await firstTender.selectOption("CASH");
  await page.getByLabel("Tender 1 amount", { exact: true }).fill("50.00");
  await page.getByRole("button", { name: "Add payment" }).click();
  await page.getByLabel("Tender 2", { exact: true }).selectOption("UPI_PHONEPE");
  await page.getByRole("button", { name: "Fill rest" }).last().click();
  await expect(page.getByText("Payment matched")).toBeVisible();
  const postCheckout = page.getByRole("button", { name: "Post checkout" });
  await expect(postCheckout).toBeEnabled();
  await postCheckout.click();
}

async function expectCsvText(
  response: APIResponse,
  expected: readonly string[],
): Promise<void> {
  const body = await response.text();
  for (const text of expected) {
    expect(body).toContain(text);
  }
}

function uniqueBillLabel(suffix: string): string {
  return `${E2E_PREFIX} ${suffix} ${Date.now()}`;
}

async function expectSelectedBill(page: Page, billLabel: string): Promise<void> {
  const currentBill = page.locator("aside");
  await expect(currentBill.getByText("Selected bill")).toBeVisible();
  await expect(currentBill.getByText(billLabel)).toBeVisible();
}

async function cleanupE2eBills(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for E2E cleanup.");
  }

  const client = new Client({ connectionString });
  const cleanupPatterns = AUTOMATION_CLEANUP_PREFIXES.map(
    (prefix) => `${prefix}%`,
  );
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE resources
        SET status = 'AVAILABLE'
        WHERE id IN (
          SELECT ttl.resource_id
          FROM tab_timed_lines ttl
          JOIN tabs t ON t.id = ttl.tab_id
          WHERE t.customer_label LIKE ANY($1::text[])
            AND ttl.resource_id IS NOT NULL
            AND ttl.status IN ('RUNNING', 'PAUSED')
        )
      `,
      [cleanupPatterns],
    );
    await client.query(
      `
        UPDATE tab_timed_lines ttl
        SET status = 'STOPPED'
        FROM tabs t
        WHERE ttl.tab_id = t.id
          AND t.customer_label LIKE ANY($1::text[])
          AND ttl.status IN ('RUNNING', 'PAUSED')
      `,
      [cleanupPatterns],
    );
    await client.query(
      `
        UPDATE tabs
        SET status = 'VOIDED',
            voided_at = COALESCE(voided_at, NOW()),
            closed_at = COALESCE(closed_at, NOW())
        WHERE customer_label LIKE ANY($1::text[])
          AND status IN ('OPEN', 'REOPENED')
      `,
      [cleanupPatterns],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
