import { test, expect } from "@playwright/test";

test.describe("Ask My CFO", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("tim@financeking.local");
    await page.getByLabel("Password").fill("demo12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard**");
  });

  test("Ask My CFO button opens panel on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    await expect(page.getByText("Ask My CFO").first()).toBeVisible();
    await expect(page.getByText("Try a suggested question").first()).toBeVisible();
    await expect(page.getByText("Can I afford dinner tonight?").first()).toBeVisible();
  });

  test("user can ask a safe-to-spend question", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    const panel = page.locator('[class*="md:w-[28rem]"]');
    const input = panel.getByPlaceholder("Ask about safe-to-spend, affordability, debt…");
    await input.fill("How much can I safely spend today?");
    await panel.getByRole("button", { name: "Send question" }).click();
    await expect(panel.getByText("Direct answer")).toBeVisible({ timeout: 30000 });
    await expect(panel.getByText("Safe to spend").first()).toBeVisible();
  });

  test("mobile shows CFO sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("button", { name: /CFO/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Grounded in your confirmed balances")).toBeVisible();
  });
});
