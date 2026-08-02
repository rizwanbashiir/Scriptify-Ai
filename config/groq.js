// import Groq from "groq-sdk";
// import dotenv from "dotenv";

// dotenv.config({ override: true });
// console.log("here")
// // Initialize the Groq client
// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// console.log("hiiiiiiiiiiiii")

// // Default model to use (Mixtral 8x7b is great for general tasks and JSON generation)
// export const GROQ_MODEL = process.env.GROQ_MODEL || "mixtral-8x7b-32768";
// console.log("inside")
// /**
//  * Send a chat-style request to Groq API.
//  * 
//  * @param {Array} messages   - Array of message objects { role, content }
//  * @param {object} options   - Additional options like temperature, maxTokens, format
//  * @returns {Promise<string>} - The text response content
//  */
// export const groqChat = async (messages, options = {}) => {
//   console.log("at line 21")
//   try {
//     const chatCompletion = await groq.chat.completions.create({
//       messages,
//       model: options.model || GROQ_MODEL,
//       temperature: options.temperature ?? 0.7,
//       max_tokens: options.maxTokens ?? 2000,
//       response_format: options.format === "json" ? { type: "json_object" } : undefined,
//     });
//     return chatCompletion.choices[0]?.message?.content || "";
//   } catch (error) {
//     throw new Error(`Groq chat error: ${error.message}`);
//   }
// };

// /**
//  * Safely parse JSON from Groq response.
//  * Groq might wrap JSON in markdown blocks when not strictly enforcing JSON mode,
//  * though response_format: { type: "json_object" } usually guarantees valid JSON.
//  *
//  * @param {string} text - Raw response text
//  * @returns {object} Parsed JSON object
//  */
// export const parseGroqJSON = (text) => {
//   try {
//     return JSON.parse(text);
//   } catch (err) {
//     // If straightforward parse fails, try extracting from markdown fences
//     const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
//     if (jsonMatch) {
//       return JSON.parse(jsonMatch[1]);
//     }

//     // Attempt to extract anything that looks like JSON { ... } or [ ... ]
//     const fallbackMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
//     if (fallbackMatch) {
//       return JSON.parse(fallbackMatch[1]);
//     }

//     throw new Error("No valid JSON found in Groq response");
//   }
// };


import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config({ override: true });

// Initialize the Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Default model to use (Llama 3.3 70B is a strong general-purpose choice for JSON generation)
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
/**
 * Send a chat-style request to Groq API.
 * 
 * @param {Array} messages   - Array of message objects { role, content }
 * @param {object} options   - Additional options like temperature, maxTokens, format
 * @returns {Promise<string>} - The text response content
 */
export const groqChat = async (messages, options = {}) => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: options.model || GROQ_MODEL,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      response_format: options.format === "json" ? { type: "json_object" } : undefined,
    });
    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    throw new Error(`Groq chat error: ${error.message}`);
  }
};

/**
 * Safely parse JSON from Groq response.
 * Groq might wrap JSON in markdown blocks when not strictly enforcing JSON mode,
 * though response_format: { type: "json_object" } usually guarantees valid JSON.
 *
 * @param {string} text - Raw response text
 * @returns {object} Parsed JSON object
 */
export const parseGroqJSON = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    // If straightforward parse fails, try extracting from markdown fences
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Attempt to extract anything that looks like JSON { ... } or [ ... ]
    const fallbackMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (fallbackMatch) {
      return JSON.parse(fallbackMatch[1]);
    }

    throw new Error("No valid JSON found in Groq response");
  }
};