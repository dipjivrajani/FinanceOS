// ============================================================
// FINANCEOS - CENTRALIZED INSUFFICIENT FUNDS VALIDATION SERVICE
// ============================================================
// Authoritative, concurrency-safe funds validation engine
// Single source of truth for all outflow/payment authorizations
// ============================================================

const { calculateMonthlyCashFlowBreakdown } = require("./cashFlowBreakdown");

// In-memory per-user lock queue for concurrency protection
const userLocks = new Map();

/**
 * Executes an async task while holding an exclusive lock for the given userId.
 * Serializes concurrent payment requests for the same user so that fresh
 * balance calculations cannot be bypassed by simultaneous requests.
 * Uses a FIFO promise chain to ensure absolute serialization.
 */
async function withUserPaymentLock(userId, asyncFn) {
  const key = String(userId);

  const prevLock = userLocks.get(key) || Promise.resolve();

  let release;
  const currentLock = new Promise((resolve) => {
    release = resolve;
  });

  userLocks.set(key, currentLock);

  try {
    await prevLock;
    return await asyncFn();
  } finally {
    release();
    if (userLocks.get(key) === currentLock) {
      userLocks.delete(key);
    }
  }
}

/**
 * Formats a numeric amount using Indian Rupee format (e.g. ₹15,000, ₹0, -₹5,000).
 */
function formatRupees(val) {
  const num = Math.round(Number(val) || 0);
  if (num < 0) {
    return "-₹" + Math.abs(num).toLocaleString("en-IN");
  }
  return "₹" + num.toLocaleString("en-IN");
}

/**
 * Parses target year and month from selectedMonth string or date.
 * Fallbacks to current calendar month.
 */
function parsePeriod(selectedMonth, fallbackDate = null) {
  const now = fallbackDate ? new Date(fallbackDate) : new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (selectedMonth && typeof selectedMonth === "string") {
    const parts = selectedMonth.trim().split("-");
    if (parts.length >= 2) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      if (Number.isInteger(y) && y >= 2000 && y <= 2100 && Number.isInteger(m) && m >= 1 && m <= 12) {
        year = y;
        month = m;
      }
    }
  }

  return {
    year,
    month,
    iso: `${year}-${String(month).padStart(2, "0")}`,
  };
}

/**
 * Validates that requested outflow amount does NOT exceed the user's
 * genuinely available funds (Available to Allocate) for the target month.
 *
 * Throws structured Error with code "INSUFFICIENT_FUNDS" or "INVALID_AMOUNT"
 * when validation fails.
 */
async function validateSufficientFunds({ userId, year, month, requestedAmount }) {
  const amount = Number(requestedAmount);

  // 1. Amount validity check
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("Payment amount must be a valid positive number.");
    err.code = "INVALID_AMOUNT";
    err.statusCode = 400;
    throw err;
  }

  // 2. Target period normalization
  const targetYear = Number(year) || new Date().getFullYear();
  const targetMonth = Number(month) || (new Date().getMonth() + 1);

  // 3. Recalculate authoritative available funds using fresh database records
  const breakdown = await calculateMonthlyCashFlowBreakdown({
    userId,
    year: targetYear,
    month: targetMonth,
  });

  const availableToAllocate = Number(breakdown.availableToAllocate) || 0;

  // 4. Authoritative funds check
  if (amount > availableToAllocate) {
    const message = `You don't have sufficient funds available to make this payment. Your available balance is ${formatRupees(
      availableToAllocate
    )}, but the requested amount is ${formatRupees(amount)}.`;

    const err = new Error(message);
    err.code = "INSUFFICIENT_FUNDS";
    err.statusCode = 400;
    err.availableAmount = availableToAllocate;
    err.requestedAmount = amount;
    err.shortfall = amount - availableToAllocate;
    err.period = { year: targetYear, month: targetMonth };
    throw err;
  }

  return {
    allowed: true,
    availableAmount: availableToAllocate,
    requestedAmount: amount,
    breakdown,
  };
}

/**
 * Standard HTTP error responder for insufficient funds or invalid amount errors.
 * Returns true if the error was handled, false otherwise.
 */
function handleFundsError(res, error) {
  if (error && error.code === "INSUFFICIENT_FUNDS") {
    res.status(400).json({
      success: false,
      code: "INSUFFICIENT_FUNDS",
      message: error.message,
      availableAmount: error.availableAmount !== undefined ? error.availableAmount : 0,
      requestedAmount: error.requestedAmount !== undefined ? error.requestedAmount : 0,
      shortfall: error.shortfall !== undefined ? error.shortfall : 0,
    });
    return true;
  }

  if (error && error.code === "INVALID_AMOUNT") {
    res.status(400).json({
      success: false,
      code: "INVALID_AMOUNT",
      message: error.message,
    });
    return true;
  }

  return false;
}

module.exports = {
  validateSufficientFunds,
  withUserPaymentLock,
  formatRupees,
  parsePeriod,
  handleFundsError,
};
