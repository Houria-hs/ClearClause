import { test, expect } from "@playwright/test";

const api = "http://localhost:5000/api";
const password = "Password123!";

async function createVerifiedUser(request, suffix) {
  const email = `ask-${suffix}-${Date.now()}@gmail.com`;
  const registration = await request.post(`${api}/auth/register`, { data: { username: "Ask User", email, password } });
  expect(registration.status()).toBe(201);
  const verification = await request.post(`${api}/auth/test/verification-link`, { data: { email } });
  const { verificationUrl } = await verification.json();
  expect((await request.get(verificationUrl, { maxRedirects: 0 })).status()).toBe(302);
  const login = await request.post(`${api}/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  return (await login.json()).token;
}

test("Ask ClearClause only answers questions for the authenticated user's selected document", async ({ request }) => {
  const ownerToken = await createVerifiedUser(request, "owner");
  const headers = { Authorization: `Bearer ${ownerToken}` };
  const seed = await request.post(`${api}/documents/test/seed`, {
    headers,
    data: {
      filename: "Service agreement.pdf",
      extractedText: "Either party may terminate this agreement with thirty days written notice. A late payment fee applies after ten days.",
      analysis: [{ text: "Either party may terminate this agreement with thirty days written notice.", risk: "Medium", explanation: "Termination requires notice." }],
    },
  });
  expect(seed.status()).toBe(201);
  const { documentId } = await seed.json();

  const document = await request.get(`${api}/documents/${documentId}`, { headers });
  expect(document.status()).toBe(200);
  expect((await document.json()).filename).toBe("Service agreement.pdf");
  expect((await request.get(`${api}/documents/${documentId}`)).status()).toBe(401);

  const answer = await request.post(`${api}/documents/${documentId}/ask`, { headers, data: { question: "Can I terminate this agreement?" } });
  expect(answer.ok()).toBeTruthy();
  const body = await answer.json();
  expect(body.documentId).toBe(documentId);
  expect(body.answer).toContain("thirty days");
  expect(body.sources).toHaveLength(1);

  expect((await request.post(`${api}/documents/${documentId}/ask`, { data: { question: "Can I terminate?" } })).status()).toBe(401);
  expect((await request.post(`${api}/documents/${documentId}/ask`, { headers, data: { question: "   " } })).status()).toBe(400);

  const quotaFallback = await request.post(`${api}/documents/${documentId}/ask`, { headers, data: { question: "__TEST_GEMINI_QUOTA__" } });
  expect(quotaFallback.status()).toBe(200);
  expect((await quotaFallback.json()).notice).toMatch(/rate-limited/i);

  const providerFailure = await request.post(`${api}/documents/${documentId}/ask`, { headers, data: { question: "__TEST_GEMINI_FAILURE__" } });
  expect(providerFailure.status()).toBe(502);

  const otherToken = await createVerifiedUser(request, "other");
  expect((await request.get(`${api}/documents/${documentId}`, { headers: { Authorization: `Bearer ${otherToken}` } })).status()).toBe(404);
  expect((await request.post(`${api}/documents/${documentId}/ask`, { headers: { Authorization: `Bearer ${otherToken}` }, data: { question: "Can I terminate?" } })).status()).toBe(404);
});
