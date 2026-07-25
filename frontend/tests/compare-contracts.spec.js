import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const api = "http://localhost:5000/api";
const password = "Password123!";
const pdf = readFileSync(resolve("..", "backend", "uploads", "a6d9e622cbc409d28f2fef01dcf915fa"));

async function verifiedToken(request, suffix) {
  const email = `compare-${suffix}-${Date.now()}@gmail.com`;
  expect((await request.post(`${api}/auth/register`, { data: { username: "Compare User", email, password } })).status()).toBe(201);
  const { verificationUrl } = await (await request.post(`${api}/auth/test/verification-link`, { data: { email } })).json();
  expect((await request.get(verificationUrl, { maxRedirects: 0 })).status()).toBe(302);
  return (await (await request.post(`${api}/auth/login`, { data: { email, password } })).json()).token;
}

const contract = (name) => ({ name, mimeType: "application/pdf", buffer: pdf });

test("comparison API requires both valid authenticated PDF contracts and returns structured results", async ({ request }) => {
  const token = await verifiedToken(request, "api");
  const headers = { Authorization: `Bearer ${token}` };
  expect((await request.post(`${api}/compare`, { multipart: { contractA: contract("a.pdf"), contractB: contract("b.pdf") } })).status()).toBe(401);
  expect((await request.post(`${api}/compare`, { headers, multipart: { contractA: contract("a.pdf") } })).status()).toBe(400);
  expect((await request.post(`${api}/compare`, { headers, multipart: { contractA: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("not a pdf") }, contractB: contract("b.pdf") } })).status()).toBe(400);
  expect((await request.post(`${api}/compare`, { headers, multipart: { contractA: { name: "large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }, contractB: contract("b.pdf") } })).status()).toBe(400);

  const response = await request.post(`${api}/compare`, { headers, multipart: { contractA: contract("contract-a.pdf"), contractB: contract("contract-b.pdf") } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.comparison.overallVerdict.preferredContract).toBe("B");
  expect(body.comparison.categories).not.toHaveLength(0);
  expect(body.comparison.categories[0]).toMatchObject({ category: "Termination", moreFavorable: "B" });

  expect((await request.post(`${api}/compare`, { headers: { ...headers, "x-test-compare-failure": "1" }, multipart: { contractA: contract("a.pdf"), contractB: contract("b.pdf") } })).status()).toBe(502);
});

test("Compare Contracts page validates uploads, compares contracts, and supports mobile", async ({ page, request }) => {
  const token = await verifiedToken(request, "ui");
  await page.addInitScript((authToken) => localStorage.setItem("token", authToken), token);
  await page.goto("/compare-contracts");
  const pageHeading = page.getByRole("heading", { name: "Compare Contracts" });
  await expect(pageHeading).toBeVisible();
  const headingBox = await pageHeading.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(Math.abs((headingBox.x + headingBox.width / 2) - 640)).toBeLessThan(8);
  const compareButton = page.getByRole("button", { name: "Compare Contracts" });
  await expect(compareButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add Contract A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add Contract B" })).toBeVisible();
  await page.getByLabel("Contract A").setInputFiles(contract("contract-a.pdf"));
  await expect(compareButton, "Compare is unavailable until both contracts are selected").toBeDisabled();
  await page.getByLabel("Contract B").setInputFiles(contract("contract-b.pdf"));
  await expect(compareButton, "Compare becomes available after both contracts are selected").toBeEnabled();
  await compareButton.click();
  await expect(page.getByRole("status")).toContainText(/Extracting clauses/i);
  await expect(page.getByText("Overall verdict")).toBeVisible();
  expect(await page.getByText("Overall verdict").evaluate((element) => getComputedStyle(element.parentElement.parentElement).textAlign)).toBe("center");
  await expect(page.getByText("Where the contracts differ")).toBeVisible();
  await expect(page.getByText("Advantages and tradeoffs")).toBeVisible();
  await expect(page.getByText("Contract A advantages")).toBeVisible();
  await expect(page.getByText("Contract B advantages")).toBeVisible();
  for (const viewport of [
    { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 },
    { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByText("Overall verdict")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  }
});

test("Compare Contracts redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/compare-contracts");
  await expect(page).toHaveURL(/\/login$/);
});
