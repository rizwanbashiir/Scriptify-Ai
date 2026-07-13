import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Scriptify AI API",
      version: "1.0.0",
      description:
        "Full REST API documentation for Scriptify AI — a blogging platform with AI-powered writing tools, recommendations, and admin controls.",
      contact: {
        name: "Scriptify AI Team",
        email: "rehmatwani1@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token",
        },
      },
      schemas: {
        // ── User ──────────────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d1" },
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            email: { type: "string", example: "john@example.com" },
            mobile: { type: "string", example: "+923001234567" },
            role: { type: "string", enum: ["user", "blogger", "admin"], example: "blogger" },
            avatar: { type: "string", example: "https://res.cloudinary.com/..." },
            bio: { type: "string", example: "Passionate tech writer." },
            isVerified: { type: "boolean", example: true },
            isSuspended: { type: "boolean", example: false },
            followersCount: { type: "integer", example: 42 },
            followingCount: { type: "integer", example: 15 },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Blog ─────────────────────────────────────────────────────────────
        Blog: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d2" },
            title: { type: "string", example: "Getting Started with AI Writing" },
            content: { type: "string", example: "In this post we explore..." },
            thumbnail: { type: "string", example: "https://res.cloudinary.com/..." },
            author: { $ref: "#/components/schemas/User" },
            tags: { type: "array", items: { type: "string" }, example: ["AI", "Writing"] },
            status: { type: "string", enum: ["draft", "published"], example: "published" },
            isFeatured: { type: "boolean", example: false },
            likesCount: { type: "integer", example: 128 },
            commentsCount: { type: "integer", example: 14 },
            views: { type: "integer", example: 540 },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Comment ──────────────────────────────────────────────────────────
        Comment: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d3" },
            text: { type: "string", example: "Great post!" },
            author: { $ref: "#/components/schemas/User" },
            blog: { type: "string", example: "64a1f2b3c4d5e6f7a8b9c0d2" },
            isFlagged: { type: "boolean", example: false },
            sentiment: { type: "string", enum: ["positive", "negative", "neutral"], example: "positive" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ── Auth Tokens ──────────────────────────────────────────────────────
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
            refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
          },
        },

        // ── Error ────────────────────────────────────────────────────────────
        Error: {
          type: "object",
          properties: {
            message: { type: "string", example: "Something went wrong" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  msg: { type: "string" },
                },
              },
            },
          },
        },

        // ── Pagination ───────────────────────────────────────────────────────
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer", example: 100 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 10 },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "User authentication & account management" },
      { name: "Users", description: "User profile, follow, and bookmarks" },
      { name: "Blogs", description: "Blog CRUD, likes, and comments" },
      { name: "AI", description: "AI-powered writing tools and recommendations" },
      { name: "Admin", description: "Admin dashboard and moderation (admin role required)" },
      { name: "Health", description: "Server health check" },
    ],
  },
  apis: [
    "./route/user/userRoute.js",
    "./route/blog/blogRoute.js",
    "./route/ai/aiRoute.js",
    "./route/admin/adminRoute.js",
    "./main.js",
  ],
};

export const swaggerSpec = swaggerJSDoc(options);
