// ============================================================
// FINANCEOS - INVESTMENT ROUTES
// ============================================================

const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  addInvestment,
  getInvestments,
  getInvestment,
  updateInvestment,
  deleteInvestment,
  recordFDInterest,
  getSIPContributions,
  addSIPContribution,
  addInvestmentTransaction,
  updateSIPContribution,
  recordInvestmentMaturity,
  renewInvestment,
  processInvestmentMaturityAction,
  getInvestmentMaturityAllocations,
} = require("../controllers/investmentController");

// ============================================================
// INVESTMENT ROUTES
// ============================================================

// Add Investment
router.post(
  "/",
  authMiddleware,
  addInvestment
);

// Get All Investments
router.get(
  "/",
  authMiddleware,
  getInvestments
);

// ============================================================
// SIP CONTRIBUTIONS
// ============================================================

// Get SIP contribution history
router.get(
  "/:id/contributions",
  authMiddleware,
  getSIPContributions
);

// Add SIP contribution
router.post(
  "/:id/contributions",
  authMiddleware,
  addSIPContribution
);

// Update SIP contribution
router.put(
  "/:id/contributions/:contributionId",
  authMiddleware,
  updateSIPContribution
);

// Add Investment Transaction (Buy, Additional Investment, etc.)
router.post(
  "/:id/transactions",
  authMiddleware,
  addInvestmentTransaction
);

// ============================================================
// CORE INVESTMENT
// ============================================================

// Get Single Investment
router.get(
  "/:id",
  authMiddleware,
  getInvestment
);

// Update Investment
router.put(
  "/:id",
  authMiddleware,
  updateInvestment
);

// Delete Investment
router.delete(
  "/:id",
  authMiddleware,
  deleteInvestment
);

// ============================================================
// FD / MATURITY / RENEWAL
// ============================================================

// Record FD Interest
router.post(
  "/:id/interest",
  authMiddleware,
  recordFDInterest
);

// Record Investment Maturity
router.post(
  "/:id/maturity",
  authMiddleware,
  recordInvestmentMaturity
);

// Renew Investment
router.post(
  "/:id/renew",
  authMiddleware,
  renewInvestment
);

// Process Investment Maturity Action
router.post(
  "/:id/maturity-action",
  authMiddleware,
  processInvestmentMaturityAction
);

// Get Investment Maturity Allocations
router.get(
  "/:id/maturity-allocations",
  authMiddleware,
  getInvestmentMaturityAllocations
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;