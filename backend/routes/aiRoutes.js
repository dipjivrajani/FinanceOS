// ============================================================
// FINANCEOS - AI ADVISER & MARKET DATA ROUTES
// ============================================================

const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const aiAdviserController = require("../controllers/aiAdviserController");

// Generate new recommendation using Gemini + live MongoDB financial data
router.post("/generate", authMiddleware, aiAdviserController.generateSuggestion);

// Get latest persisted recommendation from MongoDB (fast, no Gemini API call)
router.get("/latest", authMiddleware, aiAdviserController.getLatestSuggestion);

// Get past recommendation history
router.get("/history", authMiddleware, aiAdviserController.getSuggestionHistory);

// Get current verified market benchmarks (Gold, Silver, Equities/Nifty, Sensex, Bank FDs, Govt Schemes)
router.get("/market-data", authMiddleware, aiAdviserController.getMarketData);

// Force refresh verified market benchmarks from live providers
router.post("/market-data/refresh", authMiddleware, aiAdviserController.refreshMarketData);

module.exports = router;
