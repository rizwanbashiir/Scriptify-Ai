/**
 * Hugging Face & Groq AI — Sentiment Analysis Service
 *
 * Labels returned: POSITIVE | NEGATIVE | TOXIC | NEUTRAL
 */

import { groqChat, parseGroqJSON } from "../config/groq.js";

const HF_API_URL =
  "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english";

const TOXIC_KEYWORDS = [
  "kill", "hate", "die", "stupid", "idiot", "worthless",
  "spam", "scam", "abuse", "trash", "garbage", "fuck", "shit", "bitch",
];

const POSITIVE_KEYWORDS = [
  "amazing", "great", "awesome", "excellent", "wonderful", "love", "fantastic", "helpful", "informative", "good", "best"
];

const NEGATIVE_KEYWORDS = [
  "bad", "poor", "boring", "terrible", "worst", "wrong", "disappointing"
];

/**
 * Analyzes sentiment of a given text string.
 *
 * @param {string} text - The comment text to analyze
 * @returns {Promise<{ label: string, score: number, explanation?: string }>}
 *   label: "POSITIVE" | "NEGATIVE" | "TOXIC" | "NEUTRAL"
 *   score: confidence value 0–1
 */
export const analyzeSentiment = async (text) => {
  if (!text || typeof text !== "string") {
    return { label: "NEUTRAL", score: 0.5 };
  }

  const lowerText = text.toLowerCase();
  const hasToxicKeyword = TOXIC_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, "i").test(lowerText)
  );

  // If obviously toxic keyword is present, immediately flag as TOXIC
  if (hasToxicKeyword) {
    return {
      label: "TOXIC",
      score: 0.95,
      explanation: "Contains flagged toxic or abusive vocabulary",
    };
  }

  // 1. Try Hugging Face API if key is present
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text.substring(0, 512) }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data[0]) {
          const results = data[0];
          const topResult = results.reduce((a, b) => (a.score > b.score ? a : b));
          let label = topResult.label; // "POSITIVE" | "NEGATIVE"

          if (label === "NEGATIVE" && topResult.score > 0.85) {
            label = "TOXIC";
          }

          return {
            label,
            score: parseFloat(topResult.score.toFixed(4)),
          };
        }
      }
    } catch (error) {
      console.warn("Hugging Face sentiment failed, falling back to Groq:", error.message);
    }
  }

  // 2. Try Groq AI (Llama / Mixtral) which is already configured in .env
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are an expert sentiment analyzer and content moderator. Analyze the input text and return ONLY valid JSON with structure: { \"label\": \"POSITIVE\" | \"NEGATIVE\" | \"TOXIC\" | \"NEUTRAL\", \"score\": 0.95, \"explanation\": \"short reason\" }. Classify hate speech, severe toxicity, insults, harassment, or spam as TOXIC.",
      },
      {
        role: "user",
        content: `Analyze the sentiment and toxicity of this text:\n\n"${text.substring(0, 500)}"`,
      },
    ];

    const raw = await groqChat(messages, { temperature: 0.1, maxTokens: 150, format: "json" });
    const parsed = parseGroqJSON(raw);

    const validLabels = ["POSITIVE", "NEGATIVE", "TOXIC", "NEUTRAL"];
    const label = validLabels.includes(parsed.label?.toUpperCase())
      ? parsed.label.toUpperCase()
      : "NEUTRAL";
    const score = typeof parsed.score === "number" ? parsed.score : 0.9;

    return {
      label,
      score: parseFloat(score.toFixed(4)),
      explanation: parsed.explanation || "",
    };
  } catch (error) {
    console.warn("Groq sentiment analysis fallback failed, using rule-based analysis:", error.message);
  }

  // 3. Rule-based local fallback if external AI APIs fail
  const hasPositive = POSITIVE_KEYWORDS.some((kw) => lowerText.includes(kw));
  const hasNegative = NEGATIVE_KEYWORDS.some((kw) => lowerText.includes(kw));

  if (hasPositive && !hasNegative) {
    return { label: "POSITIVE", score: 0.85 };
  } else if (hasNegative && !hasPositive) {
    return { label: "NEGATIVE", score: 0.85 };
  }

  return { label: "NEUTRAL", score: 0.7 };
};