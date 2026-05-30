/**
 * Free Image Generation Service — Module 7
 *
 * Strategy (all free, no API key needed):
 *  Primary:  Pollinations.ai — free, no key, no rate limit (fair use)
 *  Fallback: Picsum Photos placeholder (always works, great for dev)
 *
 * Pollinations.ai is a free, open-source AI image generation service
 * that uses Stable Diffusion under the hood.
 * Docs: https://pollinations.ai
 *
 * For production with better quality, self-host:
 *  - Automatic1111 (Stable Diffusion WebUI) — set STABLE_DIFFUSION_URL in .env
 *  - ComfyUI
 */

import { uploadImageFromUrl } from "../utils/db/cloudinary.js";

const STABLE_DIFFUSION_URL = process.env.STABLE_DIFFUSION_URL || null;

/**
 * Generate a blog thumbnail image — completely free.
 *
 * @param {string} prompt - Image generation prompt
 * @returns {{ imageUrl: string, cloudinaryUrl: string|null, publicId: string|null }}
 */
export const generateBlogThumbnail = async (prompt) => {
  let imageUrl;

  // Option 1: Self-hosted Stable Diffusion (Automatic1111 API)
  if (STABLE_DIFFUSION_URL) {
    imageUrl = await generateWithStableDiffusion(prompt);
  } else {
    // Option 2: Pollinations.ai — free public API, no key needed
    imageUrl = generatePollinationsUrl(prompt);
  }

  // Upload to Cloudinary for permanent CDN storage
  try {
    const { cloudinaryUrl, publicId } = await uploadImageFromUrl(
      imageUrl,
      "scriptify-ai/thumbnails"
    );
    return { imageUrl, cloudinaryUrl, publicId };
  } catch (err) {
    console.error("Cloudinary upload failed — using direct URL:", err.message);
    return { imageUrl, cloudinaryUrl: null, publicId: null };
  }
};

/**
 * Pollinations.ai — completely free, no key, returns a direct image URL.
 * Encodes the prompt into a URL that serves a generated image.
 *
 * @param {string} prompt
 * @returns {string} image URL
 */
const generatePollinationsUrl = (prompt) => {
  // Clean and encode prompt
  const cleanPrompt = prompt
    .replace(/[^a-zA-Z0-9 .,!?'-]/g, " ")
    .trim()
    .substring(0, 500);

  const encoded = encodeURIComponent(
    `${cleanPrompt}, professional blog cover image, high quality, editorial style, 
     no text, no watermark, clean background, 4k, sharp`
  );

  // Width x Height — 1200x630 is ideal blog cover ratio
  const width = 1200;
  const height = 630;
  const seed = Math.floor(Math.random() * 1000000);

  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
};

/**
 * Self-hosted Stable Diffusion via Automatic1111 REST API.
 * Run locally: https://github.com/AUTOMATIC1111/stable-diffusion-webui
 * Set STABLE_DIFFUSION_URL=http://localhost:7860 in your .env
 *
 * @param {string} prompt
 * @returns {string} base64 data URL
 */
const generateWithStableDiffusion = async (prompt) => {
  const response = await fetch(`${STABLE_DIFFUSION_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${prompt}, professional blog cover, high quality, editorial photography style, 
               sharp focus, detailed, 4k, no text, no watermark`,
      negative_prompt:
        "text, watermark, logo, blurry, low quality, cartoon, anime, nsfw, ugly, bad anatomy",
      steps: 25,
      width: 1200,
      height: 630,
      cfg_scale: 7,
      sampler_name: "DPM++ 2M Karras",
    }),
  });

  if (!response.ok) {
    throw new Error(`Stable Diffusion error: ${response.status}`);
  }

  const data = await response.json();
  // Returns base64 image — convert to data URL
  return `data:image/png;base64,${data.images[0]}`;
};