/**
 * Extracts opening/renovation years from hotel text using Claude.
 */

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.FRESHNESS_CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const RATE_LIMIT_MS = parseInt(process.env.FRESHNESS_RATE_LIMIT_MS ?? "1500", 10);

let lastCallTime = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastCallTime = Date.now();
}

/**
 * @param {string} propertyName
 * @param {string} text - Collected text from provider_raw
 * @returns {Promise<object>} Extracted years and renovations
 */
async function extract(propertyName, text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  if (!text || text.trim().length < 10) {
    return {
      opening_year: null,
      last_major_renovation_year: null,
      last_soft_renovation_year: null,
      last_rebranding_year: null,
      renovations: [],
      confidence: "low",
    };
  }

  await rateLimit();

  const client = new Anthropic({ apiKey });

  const prompt = `Extract opening and renovation years from this hotel description. Return only what is explicitly stated or clearly implied. Use null for unknown.

Hotel name: ${propertyName}

Text:
${text}

Respond with valid JSON only, no markdown. Schema:
{
  "opening_year": number|null,
  "last_major_renovation_year": number|null,
  "last_soft_renovation_year": number|null,
  "last_rebranding_year": number|null,
  "renovations": [{"year": number, "scope": string, "description": string|null}],
  "confidence": "high"|"medium"|"low"
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content?.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text in Claude response");
  }

  const raw = block.text.replace(/^```json?\s*|\s*```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON from Claude: ${e.message}`);
  }

  const defaults = {
    opening_year: null,
    last_major_renovation_year: null,
    last_soft_renovation_year: null,
    last_rebranding_year: null,
    renovations: [],
    confidence: "low",
  };
  parsed = { ...defaults, ...parsed };
  if (!Array.isArray(parsed.renovations)) parsed.renovations = [];

  // Validate years are reasonable (1900–2030)
  const currentYear = new Date().getFullYear();
  const clamp = (y) =>
    y != null && y >= 1900 && y <= currentYear + 2 ? y : null;
  parsed.opening_year = clamp(parsed.opening_year);
  parsed.last_major_renovation_year = clamp(parsed.last_major_renovation_year);
  parsed.last_soft_renovation_year = clamp(parsed.last_soft_renovation_year);
  parsed.last_rebranding_year = clamp(parsed.last_rebranding_year);
  if (Array.isArray(parsed.renovations)) {
    parsed.renovations = parsed.renovations
      .filter((r) => r && typeof r.year === "number")
      .map((r) => ({
        year: clamp(r.year) ?? r.year,
        scope: r.scope ?? "unknown",
        description: r.description ?? null,
      }))
      .filter((r) => r.year != null);
  }

  return parsed;
}

module.exports = { extract };
