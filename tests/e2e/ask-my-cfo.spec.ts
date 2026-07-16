import { test, expect } from "@playwright/test";

test.describe("Ask My CFO compact UX", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("tim@financeking.local");
    await page.getByLabel("Password").fill("demo12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard**");
  });

  test("panel opens with compact header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    await expect(page.getByText("Clear answers from your real numbers")).toBeVisible();
    await expect(page.getByPlaceholder("Ask about spending, bills, or debt…")).toBeVisible();
  });

  test("dinner question shows compact verdict card", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    const panel = page.locator('[class*="md:w-[24rem]"]');
    await panel.getByPlaceholder("Ask about spending, bills, or debt…").fill("Can I afford a $50 dinner tonight?");
    await panel.getByRole("button", { name: "Send question" }).click();
    const verdict = panel.locator('[aria-label^="CFO answer"]');
    await expect(verdict).toBeVisible({ timeout: 30000 });
    await expect(verdict.getByText("Safe today")).toBeVisible();
    await expect(verdict.getByRole("button", { name: "Show details" })).toBeVisible();
    await expect(verdict.getByText("Direct answer")).not.toBeVisible();
    await expect(verdict.getByText(/Intent:/i)).not.toBeVisible();
  });

  test("details collapsed by default, expand on click", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    const panel = page.locator('[class*="md:w-[24rem]"]');
    await panel.getByPlaceholder("Ask about spending, bills, or debt…").fill("How much can I safely spend today?");
    await panel.getByRole("button", { name: "Send question" }).click();
    const verdict = panel.locator('[aria-label^="CFO answer"]');
    await expect(verdict).toBeVisible({ timeout: 30000 });
    await expect(panel.getByText("How this was calculated")).not.toBeVisible();
    await panel.getByRole("button", { name: "Show details" }).click();
    await expect(panel.getByText("How this was calculated")).toBeVisible();
    await panel.getByRole("button", { name: "Hide details" }).click();
    await expect(panel.getByText("How this was calculated")).not.toBeVisible();
  });

  test("Disneyland question returns verdict", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    const panel = page.locator('[class*="md:w-[24rem]"]');
    await panel.getByText("Can I take my daughter to Disneyland?").click();
    await expect(panel.locator('[aria-label^="CFO answer"]')).toBeVisible({ timeout: 30000 });
    await expect(panel.getByText("Your question")).toBeVisible();
  });

  test("mobile compact mode", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole("button", { name: /CFO/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder("Ask about spending, bills, or debt…")).toBeVisible();
  });

  test("suggested follow-up chips appear after answer", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: /Ask My CFO/i }).click();
    const panel = page.locator('[class*="md:w-[24rem]"]');
    await panel.getByPlaceholder("Ask about spending, bills, or debt…").fill("Can I afford dinner tonight?");
    await panel.getByRole("button", { name: "Send question" }).click();
    await expect(panel.locator('[aria-label^="CFO answer"]')).toBeVisible({ timeout: 30000 });
    await expect(panel.getByRole("button", { name: /Disneyland|Amex|next/i }).first()).toBeVisible();
  });
});
