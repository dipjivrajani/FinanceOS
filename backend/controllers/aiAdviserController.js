// ============================================================
// FINANCEOS - AI ADVISER CONTROLLER
// Controller handling AI suggestion generation, retrieval & market data
// ============================================================

const aiAdviserService = require("../services/aiAdviserService");
const { getLiveMarketBenchmarks } = require("../services/marketDataService");
const Activity = require("../models/Activity");
const User = require("../models/User");

// Helper to log user activities safely
const logActivity = async (userId, description) => {
  try {
    const user = await User.findById(userId);
    await Activity.create({
      userId,
      userName: user ? user.name : "User",
      userEmail: user ? user.email : "user@financeos.com",
      type: "Other",
      description,
    });
  } catch (error) {
    console.error("Failed to log activity:", error.message);
  }
};

// ============================================================
// GENERATE AI SUGGESTION
// POST /api/ai/generate
// ============================================================

// Map to track active in-flight generations per user with timeout
const activeGenerations = new Map();

const generateSuggestion = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User authentication required.",
    });
  }

  // Concurrency guard: prevent duplicate simultaneous generation requests (with 45s safety timeout)
  const existingStartTime = activeGenerations.get(userId);
  if (existingStartTime && Date.now() - existingStartTime < 45000) {
    return res.status(429).json({
      success: false,
      message: "An AI recommendation is already being generated for your account. Please wait.",
    });
  }

  activeGenerations.set(userId, Date.now());

  try {
    const { context = "plans_commitments", targetItem = null, selectedMonth = "" } = req.body || {};

    const suggestion = await aiAdviserService.generateUserRecommendation(userId, {
      context,
      targetItem,
      selectedMonth,
    });

    await logActivity(
      userId,
      `Generated AI Financial Recommendation: "${suggestion.title}"`
    );

    return res.status(200).json({
      success: true,
      message: "AI recommendation generated and saved successfully.",
      data: suggestion,
    });
  } catch (error) {
    console.error("Generate AI Suggestion Error:", error);

    if (error.code === "GEMINI_API_KEY_MISSING") {
      return res.status(400).json({
        success: false,
        code: "GEMINI_API_KEY_MISSING",
        message: error.message || "GEMINI_API_KEY is missing in backend/.env. Please configure a valid key to generate AI recommendations.",
        canRetry: true,
      });
    }

    if (error.code === "GEMINI_API_ERROR") {
      return res.status(503).json({
        success: false,
        code: "GEMINI_API_ERROR",
        message: error.message || "Google Gemini API encountered an error. Please retry in a few moments.",
        canRetry: true,
      });
    }

    const isDbError =
      error.name === "MongoError" ||
      error.name === "MongooseError" ||
      (error.message && error.message.toLowerCase().includes("mongo"));

    return res.status(500).json({
      success: false,
      code: "AI_GENERATION_FAILED",
      message: isDbError
        ? "Unable to access your financial records in MongoDB. Please try again."
        : error.message || "Failed to generate AI recommendation.",
      canRetry: true,
    });
  } finally {
    activeGenerations.delete(userId);
  }
};

// ============================================================
// GET LATEST SAVED AI SUGGESTION
// GET /api/ai/latest
// (Does NOT trigger Gemini API - only reads from MongoDB)
// ============================================================

const getLatestSuggestion = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const suggestion = await aiAdviserService.getLatestUserRecommendation(userId);

    return res.status(200).json({
      success: true,
      data: suggestion || null,
    });
  } catch (error) {
    console.error("Get Latest AI Suggestion Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch latest AI recommendation.",
    });
  }
};

// ============================================================
// GET AI SUGGESTION HISTORY
// GET /api/ai/history
// ============================================================

const getSuggestionHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required.",
      });
    }

    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const history = await aiAdviserService.getUserRecommendationHistory(userId, limit);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Get AI History Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch recommendation history.",
    });
  }
};

// ============================================================
// GET VERIFIED MARKET BENCHMARKS
// GET /api/ai/market-data
// ============================================================

const getMarketData = async (req, res) => {
  try {
    const market = await getLiveMarketBenchmarks({ forceFresh: false });
    return res.status(200).json({
      success: true,
      data: market,
    });
  } catch (error) {
    console.error("Get Market Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch current market benchmarks.",
    });
  }
};

// ============================================================
// REFRESH MARKET DATA
// POST /api/ai/market-data/refresh
// ============================================================

const refreshMarketData = async (req, res) => {
  try {
    const market = await getLiveMarketBenchmarks({ forceFresh: true });
    return res.status(200).json({
      success: true,
      message: "Market data refreshed successfully.",
      data: market,
    });
  } catch (error) {
    console.error("Refresh Market Data Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh market data.",
    });
  }
};

module.exports = {
  generateSuggestion,
  getLatestSuggestion,
  getSuggestionHistory,
  getMarketData,
  refreshMarketData,
};
