/**
 * Free / Low-Cost Image Generation Service
 *
 * Priority:
 * 1. Gemini 3.1 Flash Image (Nano Banana 2)
 * 2. HuggingFace FLUX.1-schnell
 * 3. Pollinations FLUX
 *
 * Output:
 * {
 *   imageUrl,
 *   cloudinaryUrl,
 *   publicId,
 *   provider
 * }
 */

import { uploadImageFromUrl } from "../utils/db/cloudinary.js";

/* ============================================================
   CONFIGURATION
============================================================ */

const GEMINI_MODEL = "gemini-3.1-flash-image";

const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const HUGGINGFACE_MODEL =
  "black-forest-labs/FLUX.1-schnell";

const HUGGINGFACE_API_URL =
  `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`;

const POLLINATIONS_BASE_URL =
    "https://image.pollinations.ai/prompt";

const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;

const REQUEST_TIMEOUT = 60_000;


/* ============================================================
   MAIN FUNCTION
============================================================ */

/**
 * Generate a blog thumbnail.
 *
 * Provider priority:
 *
 * Gemini
 *    ↓
 * HuggingFace
 *    ↓
 * Pollinations
 *
 * @param {string} prompt
 * @param {object|null} blogContext
 *
 * @returns {Promise<{
 *   imageUrl: string,
 *   cloudinaryUrl: string|null,
 *   publicId: string|null,
 *   provider: string
 * }>}
 */
export const generateBlogThumbnail = async (
  prompt,
  blogContext = null
) => {

  if (!prompt && !blogContext) {
    throw new Error(
      "Either prompt or blogContext is required"
    );
  }

  const enhancedPrompt = buildEnhancedPrompt(
    prompt,
    blogContext
  );

  console.log("\n========================================");
  console.log("🖼️ BLOG THUMBNAIL GENERATION");
  console.log("========================================");
  console.log("Prompt:", enhancedPrompt);
  console.log("========================================\n");


  let imageUrl = null;
  let provider = null;


  /* ============================================================
     1. GEMINI
  ============================================================ */

  if (process.env.GEMINI_API_KEY) {

    try {

      console.log(
        "🎨 Attempting Gemini 3.1 Flash Image..."
      );

      imageUrl = await generateWithGemini(
        enhancedPrompt,
        process.env.GEMINI_API_KEY
      );

      provider = "gemini";

      console.log(
        "✅ Gemini image generation succeeded"
      );

    } catch (error) {

      console.error(
        "❌ Gemini failed:",
        error.message
      );

    }

  } else {

    console.warn(
      "⚠️ GEMINI_API_KEY is not configured"
    );

  }


  /* ============================================================
     2. HUGGINGFACE
  ============================================================ */

  if (!imageUrl && process.env.HUGGINGFACE_API_KEY) {

    try {

      console.log(
        "🎨 Attempting HuggingFace FLUX..."
      );

      imageUrl = await generateWithHuggingFace(
        enhancedPrompt,
        process.env.HUGGINGFACE_API_KEY
      );

      provider = "huggingface";

      console.log(
        "✅ HuggingFace FLUX generation succeeded"
      );

    } catch (error) {

      console.error(
        "❌ HuggingFace failed:",
        error.message
      );

    }

  } else if (!imageUrl) {

    console.warn(
      "⚠️ HUGGINGFACE_API_KEY is not configured"
    );

  }


  /* ============================================================
     3. POLLINATIONS
  ============================================================ */

  if (!imageUrl) {

    try {

      console.log(
        "🎨 Attempting Pollinations FLUX..."
      );

      imageUrl =
        generatePollinationsUrl(
          enhancedPrompt
        );

      provider = "pollinations";

      console.log(
        "✅ Pollinations URL generated"
      );

    } catch (error) {

      console.error(
        "❌ Pollinations failed:",
        error.message
      );

      throw new Error(
        "All image generation providers failed"
      );
    }
  }


  /* ============================================================
     CLOUDINARY
  ============================================================ */

  let cloudinaryUrl = null;
  let publicId = null;

  try {

    console.log(
      `☁️ Uploading ${provider} image to Cloudinary...`
    );

    const uploadResult =
      await uploadImageFromUrl(
        imageUrl,
        "scriptify-ai/thumbnails"
      );

    cloudinaryUrl =
      uploadResult?.cloudinaryUrl || null;

    publicId =
      uploadResult?.publicId || null;

    if (cloudinaryUrl) {

      console.log(
        "✅ Cloudinary upload successful"
      );

    } else {

      console.warn(
        "⚠️ Cloudinary upload returned no URL"
      );

    }

  } catch (error) {

    /**
     * Cloudinary failure should NOT destroy
     * an otherwise successful image generation.
     */

    console.error(
      "⚠️ Cloudinary upload failed:",
      error.message
    );

  }


  /* ============================================================
     FINAL RESULT
  ============================================================ */

  return {

    // Prefer Cloudinary URL
    imageUrl:
      cloudinaryUrl || imageUrl,

    cloudinaryUrl,

    publicId,

    provider

  };
};

/* ============================================================
   PROMPT BUILDER
============================================================ */

/**
 * Build a subject-aware image generation prompt.
 *
 * The blog content is more important than the category.
 * The model should understand WHAT the article is about,
 * not simply generate a generic image for "Technology"
 * or "Health".
 */
const buildEnhancedPrompt = (prompt, blogContext = null) => {

    const title =
        blogContext?.title?.trim() || "";

    const category =
        blogContext?.category?.trim() || "";

    const tags =
        Array.isArray(blogContext?.tags)
            ? blogContext.tags
                .filter(Boolean)
                .join(", ")
            : "";

    const excerpt =
        blogContext?.excerpt
            ? String(blogContext.excerpt)
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 500)
            : "";


    /*
     * The user's prompt can describe the desired
     * style or additional requirements.
     */
    const userRequest =
        prompt?.trim() ||
        "Create the most appropriate thumbnail for this article.";


    /*
     * Generate domain-specific visual guidance.
     */
    const visualDirection =
        getVisualDirection(
            title,
            category,
            tags,
            excerpt
        );


    return `
You are creating a professional thumbnail for a blog article.

Your most important task is to make the image visually represent
THE ACTUAL SUBJECT OF THE ARTICLE.

================ BLOG INFORMATION ================

TITLE:
${title || "Unknown"}

CATEGORY:
${category || "Unknown"}

TAGS:
${tags || "None"}

SUMMARY:
${excerpt || "No summary provided"}

USER REQUEST:
${userRequest}

================ VISUAL DIRECTION ================

${visualDirection}

================ IMAGE REQUIREMENTS ================

1. The image must clearly represent the subject of the article.

2. Use the TITLE as the strongest signal for understanding
   what the article is actually about.

3. Use the SUMMARY and TAGS to understand the context.

4. Use CATEGORY as supporting information, NOT as the only
   source of visual meaning.

5. Identify the most important concept, object, person,
   environment, or activity discussed in the article and
   make it the primary visual subject.

6. Do NOT create a generic stock image.

7. Do NOT create an unrelated image simply because of the
   category.

8. The thumbnail should make sense even if the viewer has
   never seen the article.

9. Use a professional editorial/blog-cover aesthetic.

10. Wide 16:9 composition.

11. Strong central visual subject.

12. Modern, polished and visually appealing.

13. Cinematic professional lighting.

14. High detail and sharp focus.

15. Balanced composition suitable for a website thumbnail.

16. Do NOT include:
    - text
    - letters
    - captions
    - logos
    - watermarks
    - UI screenshots
    - random unrelated objects

17. Avoid excessive visual clutter.

18. Do not make the image look like a generic corporate
    presentation.

Create an image that visually communicates the article's
specific topic rather than merely representing its category.
`.trim();
};


/* ============================================================
   VISUAL DIRECTION
============================================================ */

/**
 * Creates additional visual guidance based on the actual
 * article content.
 *
 * IMPORTANT:
 *
 * We don't immediately classify the article into one category.
 * Instead, title + tags + summary are considered together.
 */
const getVisualDirection = (
    title,
    category,
    tags,
    excerpt
) => {

    const content = `
        ${title}
        ${category}
        ${tags}
        ${excerpt}
    `.toLowerCase();


    /* ========================================================
       TECHNOLOGY
    ======================================================== */

    if (
        containsAny(content, [
            "kubernetes",
            "docker",
            "devops",
            "programming",
            "javascript",
            "typescript",
            "node.js",
            "nodejs",
            "react",
            "python",
            "java",
            "software development",
            "web development",
            "backend",
            "frontend",
            "api",
            "microservices",
            "database",
            "postgresql",
            "mysql",
            "redis",
            "cloud computing",
            "aws",
            "azure",
            "google cloud",
            "cybersecurity",
            "machine learning",
            "artificial intelligence",
            "artificial intelligence",
            "deep learning",
            "generative ai"
        ])
    ) {

        return `
TECHNOLOGY VISUAL DIRECTION

Create a technology-related scene that specifically represents
the technology mentioned in the article.

Do NOT simply show a generic laptop.

Examples:

Kubernetes:
Cloud infrastructure, containers, distributed systems,
server clusters and container orchestration.

Programming:
Developer environment, source code, software architecture,
development tools and programming concepts.

Artificial Intelligence:
Neural networks, intelligent systems, AI visualization,
data processing and modern computing.

Cybersecurity:
Secure digital infrastructure, protected networks,
encryption and cybersecurity concepts.

Cloud Computing:
Cloud infrastructure, servers, distributed systems,
data centers and cloud architecture.

The exact visual must follow the article title and subject.
`;
    }


    /* ========================================================
       HEALTHCARE
    ======================================================== */

    if (
        containsAny(content, [
            "health",
            "healthcare",
            "medical",
            "medicine",
            "doctor",
            "hospital",
            "patient",
            "disease",
            "treatment",
            "therapy",
            "diagnosis",
            "nutrition",
            "fitness",
            "wellness",
            "mental health",
            "heart",
            "diabetes",
            "blood pressure",
            "cancer",
            "surgery"
        ])
    ) {

        return `
HEALTHCARE VISUAL DIRECTION

Create a healthcare or wellness-related scene specifically
based on the article subject.

The visual should represent the actual medical or health topic.

Examples:

Heart health:
Heart anatomy, cardiovascular system, healthy lifestyle,
heart-healthy foods or medical monitoring.

Nutrition:
Relevant healthy foods, nutrients, balanced meals and
nutrition concepts.

Diabetes:
Blood glucose monitoring, glucose meters, healthy lifestyle,
medical concepts related to diabetes.

Mental health:
Human-centered wellness imagery, calm environments,
emotional wellbeing and psychological health.

Medical technology:
Medical devices, healthcare professionals and technology
used in a healthcare environment.

Avoid generic hospital imagery when the article discusses
a specific health topic.
`;
    }


    /* ========================================================
       BUSINESS / FINANCE
    ======================================================== */

    if (
        containsAny(content, [
            "business",
            "startup",
            "entrepreneur",
            "entrepreneurship",
            "marketing",
            "sales",
            "finance",
            "financial",
            "investment",
            "investing",
            "stock market",
            "economy",
            "management",
            "leadership",
            "productivity",
            "company"
        ])
    ) {

        return `
BUSINESS / FINANCE VISUAL DIRECTION

Create a professional business or finance visual directly
related to the article.

Possible visual concepts include:

- financial markets
- investment
- business growth
- entrepreneurship
- strategy
- analytics
- professional teams
- company operations
- financial charts

The exact visual should be determined by the article topic.

Avoid generic handshake or office-stock imagery unless
the article specifically discusses those concepts.
`;
    }


    /* ========================================================
       TRAVEL
    ======================================================== */

    if (
        containsAny(content, [
            "travel",
            "tourism",
            "vacation",
            "holiday",
            "destination",
            "trip",
            "tour",
            "hotel",
            "beach",
            "mountain",
            "city guide"
        ])
    ) {

        return `
TRAVEL VISUAL DIRECTION

Create a visually compelling travel scene directly related
to the article.

If a specific location is mentioned, make that location the
primary visual subject.

Use:

- recognizable landmarks
- landscapes
- architecture
- local culture
- transportation
- hotels
- food
- outdoor experiences

Do not use a generic airplane or suitcase unless those are
actually relevant to the article.
`;
    }


    /* ========================================================
       EDUCATION
    ======================================================== */

    if (
        containsAny(content, [
            "education",
            "school",
            "university",
            "college",
            "student",
            "learning",
            "course",
            "tutorial",
            "exam",
            "teacher",
            "classroom",
            "study"
        ])
    ) {

        return `
EDUCATION VISUAL DIRECTION

Create an educational visual directly connected to the
article's subject.

Use relevant:

- students
- books
- classrooms
- laboratories
- educational technology
- academic environments
- learning activities

The specific academic subject should determine the visual.
`;
    }


    /* ========================================================
       SCIENCE
    ======================================================== */

    if (
        containsAny(content, [
            "science",
            "physics",
            "chemistry",
            "biology",
            "astronomy",
            "space",
            "planet",
            "galaxy",
            "dna",
            "genetics",
            "laboratory",
            "research"
        ])
    ) {

        return `
SCIENCE VISUAL DIRECTION

Create a scientifically relevant visual based on the actual
research or scientific concept in the article.

Examples:

Space:
Planets, galaxies, spacecraft and astronomical environments.

Biology:
Cells, DNA, organisms and biological structures.

Chemistry:
Molecules, chemical reactions and laboratory environments.

Physics:
Scientific experiments, physical phenomena and appropriate
scientific visualization.

Avoid generic laboratory imagery when the article has a
specific scientific subject.
`;
    }


    /* ========================================================
       FOOD
    ======================================================== */

    if (
        containsAny(content, [
            "food",
            "recipe",
            "cooking",
            "cuisine",
            "restaurant",
            "dish",
            "ingredient",
            "baking",
            "chef",
            "meal"
        ])
    ) {

        return `
FOOD / CULINARY VISUAL DIRECTION

Make the actual food or dish discussed in the article the
primary visual subject.

Use realistic:

- food
- ingredients
- cooking environments
- dishes
- culinary preparation

If the article discusses a specific cuisine, visually reflect
that cuisine.

Avoid generic restaurant imagery when a specific dish is
mentioned.
`;
    }


    /* ========================================================
       SPORTS
    ======================================================== */

    if (
        containsAny(content, [
            "football",
            "soccer",
            "cricket",
            "basketball",
            "tennis",
            "sports",
            "athlete",
            "match",
            "tournament",
            "fitness training",
            "olympics"
        ])
    ) {

        return `
SPORTS VISUAL DIRECTION

Create an energetic sports-related visual based on the exact
sport or activity discussed.

Show:

- relevant equipment
- athletes
- stadiums
- movement
- competition
- sport-specific environments

The actual sport should be immediately recognizable.
`;
    }


    /* ========================================================
       GENERAL FALLBACK
    ======================================================== */

    return `
SUBJECT-SPECIFIC VISUAL DIRECTION

The article does not match a predefined visual domain.

Analyze the title, summary and tags carefully.

Determine:

1. What is the main subject?
2. What object, person, place or concept is most important?
3. What environment is associated with that subject?
4. What visual would best communicate the article to a viewer?

Make the answer to those questions the primary visual
content of the thumbnail.

Do NOT default to:
- laptops
- generic offices
- abstract technology
- generic business people
- random stock photography

The image must be specific to the article.
`;
};


/* ============================================================
   HELPER
============================================================ */

const containsAny = (text, keywords) => {

    return keywords.some(
        keyword => text.includes(keyword)
    );

};


/* ============================================================
   GEMINI
============================================================ */

/**
 * Generate image using Gemini 3.1 Flash Image.
 *
 * Google currently recommends Gemini 3.1 Flash Image
 * for general image generation use cases.
 *
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
const generateWithGemini = async (
  prompt,
  apiKey
) => {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {

    const response = await fetch(
      GEMINI_API_URL,
      {
        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey

        },

        body: JSON.stringify({

          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {

            responseModalities: [
              "IMAGE"
            ],

            responseFormat: {
              image: {
                aspectRatio: "16:9",
                imageSize: "1K"
              }
            }

          }

        }),

        signal:
          controller.signal

      }
    );


    /* ========================================================
       ERROR HANDLING
    ======================================================== */

    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `Gemini API ${response.status}: ${errorText}`
      );
    }


    const result =
      await response.json();


    /* ========================================================
       EXTRACT IMAGE
    ======================================================== */

    const parts =
      result?.candidates?.[0]?.content?.parts;


    if (
      !Array.isArray(parts) ||
      parts.length === 0
    ) {

      throw new Error(
        "Gemini returned no content parts"
      );

    }


    const imagePart =
      parts.find(
        part =>
          part?.inlineData?.data
      );


    if (!imagePart) {

      /**
       * Sometimes Gemini can return text
       * instead of an image.
       */

      const text =
        parts
          .filter(part => part?.text)
          .map(part => part.text)
          .join(" ");

      throw new Error(
        `Gemini returned no image. Response: ${text || "empty"}`
      );
    }


    const base64 =
      imagePart.inlineData.data;

    const mimeType =
      imagePart.inlineData.mimeType ||
      "image/png";


    console.log(
      `📦 Gemini image received (${mimeType})`
    );


    return (
      `data:${mimeType};base64,${base64}`
    );

  } finally {

    clearTimeout(timeout);

  }
};


/* ============================================================
   HUGGINGFACE
============================================================ */

/**
 * Generate image using HuggingFace FLUX.1-schnell.
 */
const generateWithHuggingFace = async (
  prompt,
  apiKey
) => {

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT
    );


  try {

    const response =
      await fetch(
        HUGGINGFACE_API_URL,
        {

          method: "POST",

          headers: {

            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json"

          },

          body: JSON.stringify({

            inputs: prompt

          }),

          signal:
            controller.signal

        }
      );


    if (!response.ok) {

      const errorBody =
        await response.text();

      throw new Error(
        `HuggingFace API ${response.status}: ${errorBody}`
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    if (!arrayBuffer.byteLength) {

      throw new Error(
        "HuggingFace returned an empty image"
      );

    }


    const base64Image =
      Buffer
        .from(arrayBuffer)
        .toString("base64");


    const contentType =
      response.headers.get(
        "content-type"
      ) || "image/jpeg";


    return (
      `data:${contentType};base64,${base64Image}`
    );

  } finally {

    clearTimeout(timeout);

  }
};


/* ============================================================
   POLLINATIONS
============================================================ */

/**
 * Generate a Pollinations image URL.
 *
 * Pollinations does not return base64 here.
 * It returns a remotely accessible image URL.
 */
const generatePollinationsUrl = (
  prompt
) => {

  const cleanPrompt =
    prompt
      .replace(
        /[^a-zA-Z0-9 .,!?'"'-]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
      .substring(0, 800);


  if (!cleanPrompt) {

    throw new Error(
      "Pollinations prompt is empty"
    );

  }


  const encodedPrompt =
    encodeURIComponent(
      cleanPrompt
    );


  const seed =
    Math.floor(
      Math.random() * 1_000_000
    );


  return (
    `${POLLINATIONS_BASE_URL}/${encodedPrompt}` +
    `?width=${IMAGE_WIDTH}` +
    `&height=${IMAGE_HEIGHT}` +
    `&seed=${seed}` +
    `&model=flux` +
    `&enhance=true` +
    `&nologo=true`
  );
};


/* ============================================================
   EXPORT
============================================================ */

export default {
  generateBlogThumbnail
};