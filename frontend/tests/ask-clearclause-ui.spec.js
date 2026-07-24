import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://localhost:5000/api";
const password = "Password123!";

test("uploaded analysis opens Ask ClearClause and answers a suggested question", async ({ page, request }) => {
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  const email = `ask-ui-${Date.now()}@gmail.com`;
  const registration = await request.post(`${api}/auth/register`, { data: { username: "Ask UI User", email, password } });
  expect(registration.status()).toBe(201);
  const verification = await request.post(`${api}/auth/test/verification-link`, { data: { email } });
  const { verificationUrl } = await verification.json();
  expect((await request.get(verificationUrl, { maxRedirects: 0 })).status()).toBe(302);
  const login = await request.post(`${api}/auth/login`, { data: { email, password } });
  const { token } = await login.json();

  await page.addInitScript((authToken) => localStorage.setItem("token", authToken), token);
  await page.goto("/analyze");
  await page.locator('input[type="file"]').setInputFiles({
    name: "sample-agreement.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(resolve("..", "backend", "uploads", "a6d9e622cbc409d28f2fef01dcf915fa")),
  });

  const askButton = page.getByRole("button", { name: "Ask ClearClause" });
  await expect(askButton).toBeVisible({ timeout: 20000 });
  await askButton.click();
  await expect(page).toHaveURL(/\/ask-clearclause\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Ask ClearClause" })).toBeVisible();
  await expect(page.getByText("sample-agreement.pdf", { exact: true })).toBeVisible();
  const dedicatedUrl = page.url();
  await page.goto(dedicatedUrl);
  await expect(page.getByRole("heading", { name: "Ask ClearClause" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /what are my biggest risks/i }).click();
  await expect(page.getByText(/ClearClause/, { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/couldn't find a clear answer|based on this document/i)).toBeVisible({ timeout: 10000 });
  expect(runtimeErrors.join("\n")).not.toContain("destroy is not a function");
});
