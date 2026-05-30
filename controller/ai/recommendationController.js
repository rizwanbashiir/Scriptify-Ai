import Blog from "../../models/blog/blogs.js";
import Interaction from "../../models/interaction/interaction.js";
import User from "../../models/user/users.js";

/**
 * Personalized Blog Recommendation Engine — Module 8
 *
 * Algorithm:
 * 1. Fetch the user's interaction history (last 50 events)
 * 2. Extract preferred tags and categories (content-based filtering)
 * 3. Find blogs matching those preferences — weighted by recency + engagement
 * 4. Exclude already-read blogs
 * 5. Return a ranked, personalized feed
 */

export const getPersonalizedFeed = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const skip = (page - 1) * limit;

    // ── Step 1: Get user interaction history ──────────────────────────────────
    const interactions = await Interaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // ── Step 2: Extract preferences with weighted scoring ─────────────────────
    const tagScores = {};
    const categoryScores = {};
    const viewedBlogIds = new Set();

    const typeWeights = { like: 3, comment: 2, view: 1, bookmark: 4 };

    interactions.forEach((interaction) => {
      const weight = typeWeights[interaction.type] || 1;
      viewedBlogIds.add(interaction.blog.toString());

      (interaction.blogTags || []).forEach((tag) => {
        tagScores[tag] = (tagScores[tag] || 0) + weight;
      });

      if (interaction.blogCategory) {
        categoryScores[interaction.blogCategory] =
          (categoryScores[interaction.blogCategory] || 0) + weight;
      }
    });

    // ── Step 3: Also include user's declared preferred categories ─────────────
    const user = await User.findById(userId).select("preferredCategories").lean();
    (user?.preferredCategories || []).forEach((cat) => {
      categoryScores[cat] = (categoryScores[cat] || 0) + 5;
    });

    const topTags = Object.entries(tagScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const topCategories = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    // ── Step 4: Build recommendation query ────────────────────────────────────
    let recommendedBlogs = [];
    const excludeIds = Array.from(viewedBlogIds);

    if (topTags.length > 0 || topCategories.length > 0) {
      const query = {
        status: "published",
        _id: { $nin: excludeIds },
        $or: [],
      };

      if (topTags.length > 0) query.$or.push({ tags: { $in: topTags } });
      if (topCategories.length > 0)
        query.$or.push({ category: { $in: topCategories } });

      recommendedBlogs = await Blog.find(query)
        .populate("author", "firstName lastName avatar")
        .select("-content -seoKeywords")
        .sort({ createdAt: -1, views: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    }

    // ── Step 5: Fallback to trending if personalization is insufficient ────────
    if (recommendedBlogs.length < limit) {
      const needed = limit - recommendedBlogs.length;
      const alreadyIn = recommendedBlogs.map((b) => b._id.toString());
      const allExclude = [...excludeIds, ...alreadyIn];

      const trending = await Blog.find({
        status: "published",
        _id: { $nin: allExclude },
      })
        .populate("author", "firstName lastName avatar")
        .select("-content -seoKeywords")
        .sort({ views: -1, createdAt: -1 })
        .limit(needed)
        .lean();

      recommendedBlogs = [...recommendedBlogs, ...trending];
    }

    res.status(200).json({
      page,
      limit,
      total: recommendedBlogs.length,
      isPersonalized: topTags.length > 0 || topCategories.length > 0,
      blogs: recommendedBlogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Similar blogs — content-based filtering by shared tags and category
 * Used on the blog detail page ("You may also like...")
 */
export const getSimilarBlogs = async (req, res, next) => {
  try {
    const { blogId } = req.params;

    const blog = await Blog.findById(blogId).select("tags category author");
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const similar = await Blog.find({
      _id: { $ne: blogId },
      status: "published",
      $or: [
        { tags: { $in: blog.tags } },
        { category: blog.category },
      ],
    })
      .populate("author", "firstName lastName avatar")
      .select("-content -seoKeywords")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({ blogs: similar });
  } catch (error) {
    next(error);
  }
};

/**
 * Trending blogs — most viewed in the last 7 days
 */
export const getTrendingBlogs = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await Blog.find({
      status: "published",
      createdAt: { $gte: sevenDaysAgo },
    })
      .populate("author", "firstName lastName avatar")
      .select("-content -seoKeywords")
      .sort({ views: -1, likes: -1 })
      .limit(10)
      .lean();

    res.status(200).json({ blogs: trending });
  } catch (error) {
    next(error);
  }
};

/**
 * Log reading duration — called from frontend when user leaves a blog page
 */
export const logReadingDuration = async (req, res, next) => {
  try {
    const { blogId, duration } = req.body; // duration in seconds

    if (!blogId || !duration) {
      return res.status(400).json({ message: "blogId and duration are required" });
    }

    // Update the most recent view interaction for this user/blog
    await Interaction.findOneAndUpdate(
      { user: req.user._id, blog: blogId, type: "view" },
      { readingDuration: Math.min(duration, 3600) }, // cap at 1 hour
      { sort: { createdAt: -1 }, upsert: false }
    );

    res.status(200).json({ message: "Reading duration logged" });
  } catch (error) {
    next(error);
  }
};