/**
 * Ollama Client Config
 *
 * Ollama runs locally — completely free, no API key needed.
 * Install: https://ollama.com
 * Then run: ollama pull llama3.2
 *
 * Default base URL: http://localhost:11434
 * For production server, set OLLAMA_BASE_URL in .env
 */

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

// Model to use — llama3.2 is fast and capable for text tasks
// Alternatives: mistral, llama3.1, gemma2, phi3
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

/**
 * Send a prompt to Ollama and get a response string.
 *
 * @param {string} prompt      - The user prompt
 * @param {string} systemPrompt - Optional system instruction
 * @param {object} options     - Additional Ollama options
 * @returns {Promise<string>}  - The model's response text
 */
export const ollamaGenerate = async (prompt, systemPrompt = "", options = {}) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 1000,
        ...options,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.response?.trim() || "";
};

/**
 * Send a chat-style request to Ollama (better for structured JSON output).
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} options
 * @returns {Promise<string>}
 */
export const ollamaChat = async (messages, options = {}) => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 1500,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama chat error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.message?.content?.trim() || "";
};

/**
 * Safely parse JSON from Ollama response.
 * Ollama sometimes wraps JSON in markdown fences — this strips them.
 *
 * @param {string} text
 * @returns {any}
 */
export const parseOllamaJSON = (text) => {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the first { or [ and last } or ]
  const start = cleaned.search(/[\[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));

  if (start === -1 || end === -1) {
    throw new Error("No valid JSON found in Ollama response");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};