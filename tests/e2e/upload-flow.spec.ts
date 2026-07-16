import { test, expect } from "@playwright/test";

test.describe("Upload review type selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("tim@financeking.local");
    await page.getByLabel("Password").fill("demo12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard**");
  });

  test("upload page includes document type guidance", async ({ page }) => {
    await page.goto("/uploads");
    await expect(page.getByText("Upload → Analyzing → Review → Confirm and recalculate")).toBeVisible();
  });

  test("mobile layout shows upload center", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/uploads");
    await expect(page.getByRole("heading", { name: "Upload Center" })).toBeVisible();
    await expect(page.getByText("Upload Queue")).toBeVisible();
  });
});
