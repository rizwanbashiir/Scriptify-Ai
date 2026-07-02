/**
 * Hugging Face Inference API — Sentiment Analysis Service
 * Model: distilbert-base-uncased-finetuned-sst-2-english
 * Accuracy: 91.3% on SST-2 benchmark (per synopsis reference [13])
 *
 * Labels returned by the model: POSITIVE | NEGATIVE
 * We additionally classify NEGATIVE with high confidence as TOXIC
 * for the moderation use-case.
 */

const HF_API_URL =
  "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english";

const TOXIC_KEYWORDS = [
  "kill", "hate", "die", "stupid", "idiot", "worthless",
  "spam", "scam", "abuse", "trash", "garbage",
];

/**
 * Analyzes sentiment of a given text string.
 *
 * @param {string} text - The comment text to analyze
 * @returns {{ label: string, score: number }}
 *   label: "POSITIVE" | "NEGATIVE" | "TOXIC" | "NEUTRAL"
 *   score: confidence value 0–1
 */
export const analyzeSentiment = async (text) => {
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.warn("HUGGINGFACE_API_KEY not set. Returning NEUTRAL.");
    return { label: "NEUTRAL", score: null };
  }

  // Quick check for obvious toxic keywords (supplementary rule-based layer)
  const lowerText = text.toLowerCase();
  const hasToxicKeyword = TOXIC_KEYWORDS.some((kw) => lowerText.includes(kw));

  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text.substring(0, 512) }), // model max
    });

    if (!response.ok) {
      console.error(`Hugging Face API error: ${response.status}`);
      return { label: "NEUTRAL", score: null };
    }

    const data = await response.json();

    // Response format: [[{ label: "POSITIVE", score: 0.99 }, { label: "NEGATIVE", score: 0.01 }]]
    if (!data || !data[0]) {
      return { label: "NEUTRAL", score: null };
    }

    const results = data[0];
    const topResult = results.reduce((a, b) => (a.score > b.score ? a : b));

    let label = topResult.label; // "POSITIVE" | "NEGATIVE"

    // Classify as TOXIC if:
    // - NEGATIVE with high confidence (>0.85), OR
    // - Contains explicit toxic keyword regardless of model output
    if (
      (label === "NEGATIVE" && topResult.score > 0.85) ||
      hasToxicKeyword
    ) {
      label = "TOXIC";
    }

    return {
      label,
      score: parseFloat(topResult.score.toFixed(4)),
    };
  } catch (error) {
    console.error("Sentiment analysis failed:", error.message);
    return { label: "NEUTRAL", score: null };
  }
};