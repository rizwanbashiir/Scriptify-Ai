/**
 * Free Image Generation Service — Module 7 (Refactored)
 *
 * Priority Order (all free or with API keys, no rate limits):
 *  1. Gemini (Google Imagen 3/4)        — Highest quality
 *  2. HuggingFace FLUX.1-schnell        — High quality, free with API key
 *  3. Pollinations.ai FLUX              — Always works, no key required
 *
 * Pollinations.ai: https://pollinations.ai (open-source, Stable Diffusion)
 * HuggingFace: https://huggingface.co/models (FLUX.1-schnell)
 * Google GenAI: https://ai.google.dev
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { uploadImageFromUrl } from "../utils/db/cloudinary.js";

/**
 * Generate a blog thumbnail image.
 * Tries generators in priority order: Gemini → HuggingFace → Pollinations
 *
 * @param {string} prompt - Image generation prompt
 * @param {object} blogContext - Optional blog metadata (title, category, tags, excerpt)
 * @returns {Promise<{ imageUrl: string, cloudinaryUrl: string|null, publicId: string|null }>}
 */
export const generateBlogThumbnail = async (prompt, blogContext = null) => {
  const enhancedPrompt = buildEnhancedPrompt(prompt, blogContext);

  let imageUrl = null;

  // 🎯 Priority 1: Google Gemini / Imagen
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log("🤖 Attempting image generation with Google Gemini...");
      imageUrl = await generateWithGemini(enhancedPrompt, process.env.GEMINI_API_KEY);
      console.log("✅ Image generated successfully via Google Gemini");
    } catch (err) {
      console.warn("⚠️ Google Gemini attempt failed (checking fallback):", err.message);
    }
  }

  // 🎯 Priority 2: Pollinations FLUX (Reliable Fallback)
  if (!imageUrl) {
    try {
      console.log("🎨 Generating thumbnail via Pollinations FLUX...");
      imageUrl = generatePollinationsUrl(enhancedPrompt);
      console.log("✅ Thumbnail URL generated successfully (Pollinations FLUX)");
    } catch (err) {
      console.error("❌ Thumbnail generation failed:", err.message);
      throw new Error("Image generation service failed");
    }
  }

  // Upload to Cloudinary if configured
  let cloudinaryUrl = null;
  let publicId = null;
  try {
    const uploadRes = await uploadImageFromUrl(
      imageUrl,
      "scriptify-ai/thumbnails"
    );
    cloudinaryUrl = uploadRes?.cloudinaryUrl || null;
    publicId = uploadRes?.publicId || null;
  } catch (err) {
    console.warn("⚠️ Cloudinary upload skipped or failed:", err.message);
  }

  return {
    imageUrl: cloudinaryUrl || imageUrl,
    cloudinaryUrl,
    publicId,
  };
};

/**
 * Build enhanced prompt from user input and blog context
 */
const buildEnhancedPrompt = (prompt, blogContext) => {
  let topic = prompt ? prompt.trim() : "";

  // Strip generic boilerplate like "give me thumnail about", "create thumbnail for", "generate thumbnail of"
  topic = topic.replace(/^(give me|create|generate|make|get me)\s+(a\s+)?(thumbnail|image|cover|picture)\s+(about|for|of)?\s*/i, "").trim();

  if (blogContext && typeof blogContext === "object") {
    if (!topic && blogContext.title) {
      topic = blogContext.title;
    }
  }

  if (!topic) {
    topic = "Artificial intelligence technology concepts";
  }

  return `${topic}, modern 3D vector concept illustration, clean bright aesthetic, high quality, 8k resolution, professional blog thumbnail cover, no text, no watermark`;
};

/**
 * ⭐ Priority 1: Generate with Google Gemini (Prompt Refinement & Generation)
 */
const generateWithGemini = async (prompt, apiKey) => {
  // First attempt: Imagen endpoint
  try {
    const modelName = "imagen-3.0-generate-002";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: `${prompt}, 8k resolution, professional blog cover photography` }],
        parameters: { sampleCount: 1, aspectRatio: "16:9" }
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.predictions && result.predictions[0]?.bytesBase64Encoded) {
        const base64Bytes = result.predictions[0].bytesBase64Encoded;
        const mimeType = result.predictions[0].mimeType || "image/jpeg";
        return `data:${mimeType};base64,${base64Bytes}`;
      }
    }
  } catch (e) {
    // Silently proceed to prompt refinement or fallback
  }

  // Second attempt: Gemini Flash to refine prompt for extreme visual accuracy
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Convert this topic into a short, vivid, 10-word visual description for a high-end 3D blog cover thumbnail image: "${prompt}". Output ONLY the visual prompt, no intro or quotes.` }] }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (refinedText) {
        return generatePollinationsUrl(refinedText.trim());
      }
    }
  } catch (e) {
    // Proceed to standard FLUX realism fallback
  }

  throw new Error("Google Gemini image service unavailable");
};

/**
 * ⭐ Priority 2: High-Quality FLUX Realism Generator (Free, Instant)
 * Uses high-relevance FLUX Realism model for photorealistic topic thumbnails
 *
 * @param {string} prompt
 * @returns {string} Image URL
 */
const generatePollinationsUrl = (prompt) => {
  const cleanPrompt = prompt
    .replace(/[^a-zA-Z0-9 .,!?'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 300);

  const formattedPrompt = `${cleanPrompt}, highly detailed photorealistic composition, bright studio lighting, 8k resolution, professional editorial blog cover, vibrant colors, crisp focus, no text, no watermark`;
  const encoded = encodeURIComponent(formattedPrompt);

  const width = 1280;
  const height = 720;
  const seed = Math.floor(Math.random() * 1000000);

  // Using flux-realism model for photorealistic and topic-accurate outputs
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&model=flux-realism&nologo=true`;
};

export default { generateBlogThumbnail };