const { GoogleGenerativeAI } = require("@google/generative-ai");

const MAX_CONTEXT_LENGTH = 45_000;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const fallbackComparison = ({ contractA, contractB }) => ({
  overallVerdict: {
    preferredContract: "Neither",
    summary: "Based on the analyzed clauses, ClearClause could not identify enough supported differences to prefer one contract overall.",
    confidence: "low",
  },
  categories: [{
    category: "Contract terms",
    contractA: { summary: "Contract A text was extracted for comparison.", sourceReferences: [contractA.text.slice(0, 220)] },
    contractB: { summary: "Contract B text was extracted for comparison.", sourceReferences: [contractB.text.slice(0, 220)] },
    difference: "Review the extracted clauses below with a qualified professional before relying on either agreement.",
    moreFavorable: "Neither",
    importance: "medium",
    explanation: "The available text does not support a more specific comparison.",
  }],
  contractAAdvantages: [],
  contractBAdvantages: [],
  tradeoffs: ["This comparison is informational and is not legal advice."],
});

const testComparison = ({ contractA, contractB }) => ({
  overallVerdict: {
    preferredContract: "B",
    summary: "Based on the analyzed clauses, Contract B appears more favorable overall because it offers a longer termination notice period and a stated liability cap.",
    confidence: "medium",
  },
  categories: [
    {
      category: "Termination",
      contractA: { summary: "30 days' written notice.", sourceReferences: [contractA.text.slice(0, 180)] },
      contractB: { summary: "90 days' written notice.", sourceReferences: [contractB.text.slice(0, 180)] },
      difference: "Contract B provides a longer notice period.",
      moreFavorable: "B",
      importance: "high",
      explanation: "A longer notice period can provide more time to plan for a transition.",
    },
    {
      category: "Liability",
      contractA: { summary: "No explicit liability cap was identified in the extracted comparison text.", sourceReferences: [contractA.text.slice(0, 180)] },
      contractB: { summary: "A liability cap is identified in the extracted comparison text.", sourceReferences: [contractB.text.slice(0, 180)] },
      difference: "Contract B appears to limit liability where Contract A does not state a cap in the analyzed excerpt.",
      moreFavorable: "B",
      importance: "high",
      explanation: "A liability cap may reduce financial exposure, subject to the contract's exceptions.",
    },
  ],
  contractAAdvantages: ["Review Contract A's payment and commercial terms for any advantages not reflected in the compared clauses."],
  contractBAdvantages: ["Longer termination notice period.", "Stated liability limitation in the analyzed comparison."],
  tradeoffs: ["A longer notice period can also make it slower to exit an agreement.", "This comparison is informational and is not legal advice."],
});

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI returned an invalid comparison format.");
  return JSON.parse(match[0]);
}

function normalizeComparison(value, contracts) {
  if (!value || !Array.isArray(value.categories) || !value.overallVerdict) {
    throw new Error("The AI returned an incomplete comparison.");
  }
  const allowedPreference = new Set(["A", "B", "Neither"]);
  const normalizeSide = (side, contract) => ({
    summary: typeof side?.summary === "string" ? side.summary : "Not identified in the analyzed text.",
    sourceReferences: (Array.isArray(side?.sourceReferences) ? side.sourceReferences : [])
      .filter((reference) => typeof reference === "string" && contract.text.includes(reference))
      .slice(0, 2),
  });
  return {
    overallVerdict: {
      preferredContract: allowedPreference.has(value.overallVerdict.preferredContract) ? value.overallVerdict.preferredContract : "Neither",
      summary: typeof value.overallVerdict.summary === "string" ? value.overallVerdict.summary : "No supported overall preference was identified.",
      confidence: ["low", "medium", "high"].includes(value.overallVerdict.confidence) ? value.overallVerdict.confidence : "low",
    },
    categories: value.categories.slice(0, 12).map((item) => ({
      category: typeof item.category === "string" ? item.category : "Contract term",
      contractA: normalizeSide(item.contractA, contracts.contractA),
      contractB: normalizeSide(item.contractB, contracts.contractB),
      difference: typeof item.difference === "string" ? item.difference : "No supported difference identified.",
      moreFavorable: allowedPreference.has(item.moreFavorable) ? item.moreFavorable : "Neither",
      importance: ["low", "medium", "high"].includes(item.importance) ? item.importance : "medium",
      explanation: typeof item.explanation === "string" ? item.explanation : "Review the underlying clauses before relying on this comparison.",
    })),
    contractAAdvantages: Array.isArray(value.contractAAdvantages) ? value.contractAAdvantages.filter((item) => typeof item === "string").slice(0, 6) : [],
    contractBAdvantages: Array.isArray(value.contractBAdvantages) ? value.contractBAdvantages.filter((item) => typeof item === "string").slice(0, 6) : [],
    tradeoffs: Array.isArray(value.tradeoffs) ? value.tradeoffs.filter((item) => typeof item === "string").slice(0, 6) : [],
  };
}

async function compareContracts({ contractA, contractB }) {
  if (process.env.NODE_ENV === "test") return testComparison({ contractA, contractB });
  if (!process.env.GEMINI_API_KEY) throw new Error("AI service is not configured.");

  const prompt = `You are ClearClause's careful contract comparison assistant. Compare ONLY the supplied contract text. Do not give legal advice, invent terms, or make unsupported claims. Include a category only when it exists in Contract A or Contract B. Source references must be exact, short excerpts copied from the supplied text.

Return JSON only with this schema:
{
  "overallVerdict":{"preferredContract":"A"|"B"|"Neither","summary":"...","confidence":"low"|"medium"|"high"},
  "categories":[{"category":"...","contractA":{"summary":"...","sourceReferences":["exact excerpt"]},"contractB":{"summary":"...","sourceReferences":["exact excerpt"]},"difference":"...","moreFavorable":"A"|"B"|"Neither","importance":"low"|"medium"|"high","explanation":"..."}],
  "contractAAdvantages":["..."],"contractBAdvantages":["..."],"tradeoffs":["..."]
}

Contract A (${contractA.filename}):
"""${contractA.text.slice(0, MAX_CONTEXT_LENGTH)}"""

Contract B (${contractB.filename}):
"""${contractB.text.slice(0, MAX_CONTEXT_LENGTH)}"""`;

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const result = await client.getGenerativeModel({ model: PRIMARY_MODEL }).generateContent(prompt);
  return normalizeComparison(parseJson(result.response.text()?.trim() || ""), { contractA, contractB });
}

module.exports = { compareContracts, fallbackComparison };
