const Investment = require("../models/Investment");
const Activity = require("../models/Activity");
const User = require("../models/User");
const InvestmentMaturityAction = require("../models/InvestmentMaturityAction");
const Liability = require("../models/Liability");
const AdditionalIncome = require("../models/AdditionalIncome");
const {
  validateSufficientFunds,
  withUserPaymentLock,
  handleFundsError,
  parsePeriod,
} = require("../utils/fundValidationService");

// Helper to log user activities safely under the strict Activity schema
const logActivity = async (userId, description) => {
  try {
    const user = await User.findById(userId);
    await Activity.create({
      userId,
      userName: user ? user.name : "System User",
      userEmail: user ? user.email : "unknown@domain.com",
      type: "Other",
      description,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};

// --------------------------------------------------------
// --------------------------------------------------------
// Validate investment payload based on type and required custom fields
// --------------------------------------------------------
function validateInvestmentPayload(payload) {
  const { type, customDetails = {} } = payload;
  const errors = [];
  switch (type) {
    case "Mutual Fund": {
      const fundName = payload.schemeName || payload.fundName || customDetails.fundName;
      const units = payload.units !== undefined && payload.units !== "" ? payload.units : customDetails.units;
      if (!fundName || !String(fundName).trim()) errors.push("fundName is required for Mutual Fund");
      if (units === undefined || units === null || units === "" || Number(units) < 0) errors.push("units is required for Mutual Fund");
      break;
    }
    case "Gold": {
      const weight = payload.weight !== undefined && payload.weight !== "" ? payload.weight : customDetails.weight;
      const purity = payload.purity || customDetails.purity;
      if (weight === undefined || weight === null || weight === "" || Number(weight) <= 0) errors.push("weight is required for Gold");
      if (!purity || !String(purity).trim()) errors.push("purity is required for Gold");
      break;
    }
    case "Stocks": {
      const ticker = payload.symbol || payload.ticker || customDetails.ticker;
      const quantity = payload.quantity !== undefined && payload.quantity !== "" ? payload.quantity : customDetails.quantity;
      const purchasePrice = payload.purchasePrice !== undefined && payload.purchasePrice !== "" ? payload.purchasePrice : customDetails.purchasePrice;
      if (!ticker || !String(ticker).trim()) errors.push("ticker is required for Stocks");
      if (quantity === undefined || quantity === null || quantity === "" || Number(quantity) <= 0) errors.push("quantity is required for Stocks");
      if (purchasePrice === undefined || purchasePrice === null || purchasePrice === "" || Number(purchasePrice) < 0) errors.push("purchasePrice is required for Stocks");
      break;
    }
    case "Recurring Deposit":
      // RD uses same fields as FD; no extra customDetails required
      break;
    case "Other":
      // No mandatory fields
      break;
    default:
      // No extra validation for SIP, FD, etc.
      break;
  }
  return { valid: errors.length === 0, errors };
}

// ============================================================
// ADD INVESTMENT
// ============================================================

const addInvestment = async (req, res) => {
  try {
    if (
      req.body.reminder?.channels?.sms === true ||
      req.body.maturityReminder?.channels?.sms === true
    ) {
      return res.status(400).json({
        success: false,
        message: "SMS notifications are not supported. FinanceOS supports only Email and In-App notifications.",
      });
    }

    const customDetails = req.body.customDetails || {};
    const investmentData = {
      ...req.body,
      user: req.user?.id || req.user?._id,
      paymentSource: req.body.paymentSource || undefined,
      paymentSourceDetails: req.body.paymentSourceDetails || undefined,
    };

    // Normalize type
    if (investmentData.type === "RD") {
      investmentData.type = "Recurring Deposit";
    }

    // Normalize amount if not supplied
    if (investmentData.amount === undefined || investmentData.amount === null || isNaN(Number(investmentData.amount))) {
      if (investmentData.contributionType === "Recurring") {
        investmentData.amount = Number(investmentData.monthlyContribution || 0);
      } else {
        investmentData.amount = Number(investmentData.principalAmount || 0);
      }
    }

    // Normalize type-specific fields onto the root document
    if (investmentData.type === "Gold") {
      investmentData.weight = Number(req.body.weight ?? customDetails.weight ?? 0);
      investmentData.purity = String(req.body.purity ?? customDetails.purity ?? "").trim();
      if (req.body.goldType) investmentData.goldType = req.body.goldType;
    } else if (investmentData.type === "Mutual Fund") {
      investmentData.schemeName = String(req.body.schemeName ?? req.body.fundName ?? customDetails.fundName ?? "").trim();
      investmentData.units = Number(req.body.units ?? customDetails.units ?? 0);
    } else if (investmentData.type === "Stocks") {
      investmentData.symbol = String(req.body.symbol ?? req.body.ticker ?? customDetails.ticker ?? "").trim();
      investmentData.companyName = String(req.body.companyName ?? req.body.name ?? "").trim();
      investmentData.quantity = Number(req.body.quantity ?? customDetails.quantity ?? 0);
      investmentData.purchasePrice = Number(req.body.purchasePrice ?? customDetails.purchasePrice ?? 0);
    } else if (investmentData.type === "Recurring Deposit" || investmentData.type === "RD") {
      investmentData.institution = String(req.body.institution ?? "").trim();
      investmentData.interestRate = Number(req.body.interestRate ?? 0);
      if (req.body.dueDay) investmentData.dueDay = Number(req.body.dueDay);
    }

    // --------------------------------------------------------
    // Run validation before persisting
    // --------------------------------------------------------
    const { valid, errors } = validateInvestmentPayload(investmentData);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Investment validation failed.",
        errors,
      });
    }

    const userId = req.user?.id || req.user?._id;

    const numericAmount = Number(investmentData.amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "Investment amount must be a valid positive number.",
      });
    }

    const result = await withUserPaymentLock(userId, async () => {
      // For One-Time purchases or FD deposits that consume available funds in the target month:
      const isOneTimeOutflow =
        investmentData.contributionType === "One-Time" ||
        investmentData.contributionType === "One Time" ||
        investmentData.type === "Fixed Deposit" ||
        investmentData.type === "Stocks" ||
        investmentData.type === "Gold" ||
        (req.body.consumeAvailableFunds === true && numericAmount > 0);

      if (isOneTimeOutflow && numericAmount > 0) {
        const period = parsePeriod(req.body.selectedMonth || req.body.startDate);
        await validateSufficientFunds({
          userId,
          year: period.year,
          month: period.month,
          requestedAmount: numericAmount,
        });

        if (!Array.isArray(investmentData.transactions)) {
          investmentData.transactions = [];
        }
        investmentData.transactions.push({
          type: "Buy",
          amount: numericAmount,
          date: req.body.startDate ? new Date(req.body.startDate) : new Date(),
          paymentSource: investmentData.paymentSource || { method: "Cash" },
          note: investmentData.type === "Fixed Deposit" ? "Initial Fixed Deposit" : "Initial Investment Purchase",
        });
      }

      const investment = await Investment.create(investmentData);
      return investment;
    });

    res.status(201).json({
      success: true,
      message: "Investment added successfully.",
      investment: result,
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    console.error("Add Investment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to add investment.",
    });
  }
};

// ============================================================
// GET ALL INVESTMENTS
// ============================================================

const getInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({
      user: req.user?.id || req.user?._id,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: investments.length,
      investments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SINGLE INVESTMENT
// ============================================================

const getInvestment = async (req, res) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: req.user?.id || req.user?._id,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    res.status(200).json({
      success: true,
      investment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// UPDATE INVESTMENT
// ============================================================

const updateInvestment = async (req, res) => {
  try {
    if (
      req.body.reminder?.channels?.sms === true ||
      req.body.maturityReminder?.channels?.sms === true
    ) {
      return res.status(400).json({
        success: false,
        message: "SMS notifications are not supported. FinanceOS supports only Email and In-App notifications.",
      });
    }

    const customDetails = req.body.customDetails || {};
    const updateData = { ...req.body };

    // Normalize type-specific fields onto updateData
    if (updateData.type === "Gold" || req.body.weight !== undefined || customDetails.weight !== undefined || req.body.purity !== undefined || customDetails.purity !== undefined) {
      if (req.body.weight !== undefined || customDetails.weight !== undefined) {
        updateData.weight = Number(req.body.weight ?? customDetails.weight ?? 0);
      }
      if (req.body.purity !== undefined || customDetails.purity !== undefined) {
        updateData.purity = String(req.body.purity ?? customDetails.purity ?? "").trim();
      }
      if (req.body.goldType) updateData.goldType = req.body.goldType;
    }
    if (updateData.type === "Mutual Fund" || req.body.schemeName !== undefined || req.body.fundName !== undefined || customDetails.fundName !== undefined || req.body.units !== undefined || customDetails.units !== undefined) {
      if (req.body.schemeName !== undefined || req.body.fundName !== undefined || customDetails.fundName !== undefined) {
        updateData.schemeName = String(req.body.schemeName ?? req.body.fundName ?? customDetails.fundName ?? "").trim();
      }
      if (req.body.units !== undefined || customDetails.units !== undefined) {
        updateData.units = Number(req.body.units ?? customDetails.units ?? 0);
      }
    }
    if (updateData.type === "Stocks" || req.body.symbol !== undefined || req.body.ticker !== undefined || customDetails.ticker !== undefined || req.body.quantity !== undefined || customDetails.quantity !== undefined) {
      if (req.body.symbol !== undefined || req.body.ticker !== undefined || customDetails.ticker !== undefined) {
        updateData.symbol = String(req.body.symbol ?? req.body.ticker ?? customDetails.ticker ?? "").trim();
      }
      if (req.body.quantity !== undefined || customDetails.quantity !== undefined) {
        updateData.quantity = Number(req.body.quantity ?? customDetails.quantity ?? 0);
      }
      if (req.body.purchasePrice !== undefined || customDetails.purchasePrice !== undefined) {
        updateData.purchasePrice = Number(req.body.purchasePrice ?? customDetails.purchasePrice ?? 0);
      }
    }

    const investment = await Investment.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user?.id || req.user?._id,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Investment updated successfully.",
      investment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DELETE INVESTMENT
// ============================================================

const deleteInvestment = async (req, res) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: req.user?.id || req.user?._id,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    await investment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Investment deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// RECORD FD INTEREST
// ============================================================

const recordFDInterest = async (req, res) => {
  try {
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: req.user?.id || req.user?._id,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    const interestAmount = Number(req.body.amount || req.body.interestAmount || 0);
    const dateVal = req.body.date || req.body.payoutDate ? new Date(req.body.date || req.body.payoutDate) : new Date();

    const transaction = {
      amount: interestAmount,
      date: dateVal,
      referenceId: req.body.referenceId || `fd-${Date.now()}`,
      note: req.body.note || "",
      month: req.body.month || (dateVal.getMonth() + 1),
      year: req.body.year || dateVal.getFullYear(),
    };

    if (!Array.isArray(investment.interestTransactions)) {
      investment.interestTransactions = [];
    }

    investment.interestTransactions.push(transaction);
    investment.totalInterestReceived = (Number(investment.totalInterestReceived) || 0) + interestAmount;

    await investment.save();

    res.status(200).json({
      success: true,
      message: "FD interest recorded successfully.",
      investment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SIP CONTRIBUTIONS
// ============================================================

const getSIPContributions = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const investment = await Investment.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      count: (investment.sipContributions || []).length,
      contributions: investment.sipContributions || [],
    });
  } catch (error) {
    console.error("Get SIP Contributions:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch SIP contributions.",
    });
  }
};

// ============================================================
// ADD INVESTMENT TRANSACTION (Mutual Fund, Gold, Stocks)
// ============================================================

const addInvestmentTransaction = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const { type, amount, quantity, price, date, destination, note } = req.body;

    const txAmount = Number(amount) || 0;
    const isOutflow = type === "Buy" || type === "Additional Investment";

    if (isOutflow) {
      if (!Number.isFinite(txAmount) || txAmount <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_AMOUNT",
          message: "Transaction amount must be a valid positive number.",
        });
      }
    }

    const result = await withUserPaymentLock(userId, async () => {
      const investment = await Investment.findOne({ _id: id, user: userId });
      if (!investment) {
        const notFound = new Error("Investment not found.");
        notFound.statusCode = 404;
        throw notFound;
      }

      if (isOutflow) {
        const period = parsePeriod(req.body.selectedMonth || date);
        await validateSufficientFunds({
          userId,
          year: period.year,
          month: period.month,
          requestedAmount: txAmount,
        });
      }

      const transaction = {
        type,
        amount: txAmount,
        quantity: Number(quantity) || 0,
        price: Number(price) || 0,
        date: date ? new Date(date) : new Date(),
        destination: destination || "",
        note: note || "",
      };

      if (!Array.isArray(investment.transactions)) {
        investment.transactions = [];
      }

      investment.transactions.push(transaction);

      // Update totals based on transaction type
      if (isOutflow) {
        investment.amount = (Number(investment.amount) || 0) + transaction.amount;
        investment.quantity = (Number(investment.quantity) || 0) + transaction.quantity;
        if (investment.type === "Mutual Fund") {
          investment.units = (Number(investment.units) || 0) + transaction.quantity;
        } else if (investment.type === "Gold") {
          investment.weight = (Number(investment.weight) || 0) + transaction.quantity;
        }
      } else if (type === "Sell" || type === "Redeem") {
        investment.quantity = Math.max(0, (Number(investment.quantity) || 0) - transaction.quantity);
        if (investment.type === "Mutual Fund") {
          investment.units = Math.max(0, (Number(investment.units) || 0) - transaction.quantity);
        } else if (investment.type === "Gold") {
          investment.weight = Math.max(0, (Number(investment.weight) || 0) - transaction.quantity);
        }
      }

      await investment.save();
      await logActivity(userId, `Added a ${type} transaction for ${investment.name}`);

      return investment;
    });

    res.status(201).json({
      success: true,
      message: "Transaction added successfully.",
      investment: result,
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("Add Investment Transaction Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

// ============================================================
const { isItemActiveInMonth, parseSelectedMonth, isDateInMonth, getMonthName } = require("../utils/monthLifecycle");
const { deriveDueDateForMonth, calculateDueDateForMonth, formatDateISO } = require("../utils/dueDateSchedule");

// ============================================================
// ADD SIP CONTRIBUTION
// ============================================================

const addSIPContribution = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const result = await withUserPaymentLock(userId, async () => {
      const investment = await Investment.findOne({
        _id: req.params.id,
        user: userId,
      });

      if (!investment) {
        const notFoundErr = new Error("Investment not found.");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const {
        amount,
        paidDate,
        status,
        note,
        selectedMonth: reqSelectedMonth
      } = req.body;

      // Determine target working month context
      const monthCtx = parseSelectedMonth(reqSelectedMonth || (paidDate ? String(paidDate).slice(0, 7) : null));
      const targetYear = monthCtx.year;
      const targetMonth = monthCtx.month;
      const formattedMonth = `${getMonthName(targetMonth)} ${targetYear}`;

      // 1. Lifecycle check: Investment must have existed on or before target month
      if (!isItemActiveInMonth(investment, targetYear, targetMonth)) {
        const invStart = new Date(investment.startDate || investment.createdAt);
        const startMonthName = getMonthName(invStart.getMonth() + 1);
        const err = new Error(`Cannot record contribution in ${formattedMonth}. This investment started in ${startMonthName} ${invStart.getFullYear()}.`);
        err.statusCode = 400;
        throw err;
      }

      let contributionAmount;
      if (amount !== undefined) {
        contributionAmount = Number(amount);
      } else {
        contributionAmount = Number(investment.monthlyContribution ?? investment.amount ?? 0);
      }

      if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
        const err = new Error("Contribution amount must be a valid positive number.");
        err.code = "INVALID_AMOUNT";
        err.statusCode = 400;
        throw err;
      }

      const contributionStatus = status || "Not Paid";
      const allowedStatuses = ["Paid", "Not Paid", "Skipped"];
      if (!allowedStatuses.includes(contributionStatus)) {
        const err = new Error("Invalid contribution status.");
        err.statusCode = 400;
        throw err;
      }

      // Check sufficient funds if contribution is being marked as Paid
      if (contributionStatus === "Paid") {
        await validateSufficientFunds({
          userId,
          year: targetYear,
          month: targetMonth,
          requestedAmount: contributionAmount,
        });
      }

      // --------------------------------------------------------
      // DERIVE DUE DATE FROM STORED SCHEDULE (server-side only)
      // The client does NOT supply dueDate for recurring plans.
      // --------------------------------------------------------
      const storedDueDay = investment.dueDay
        || (investment.reminder && investment.reminder.contributionDay)
        || (investment.nextContributionDate ? new Date(investment.nextContributionDate).getDate() : null)
        || (investment.startDate ? new Date(investment.startDate).getDate() : null)
        || (paidDate ? new Date(paidDate).getDate() : 1);

      const effectiveDueDate = calculateDueDateForMonth(storedDueDay, targetYear, targetMonth);

      const effectivePaidDate = contributionStatus === "Paid"
        ? (paidDate ? new Date(paidDate) : new Date())
        : null;

      // Validate paid date belongs to selected month
      if (reqSelectedMonth && effectivePaidDate) {
        if (!isDateInMonth(effectivePaidDate, targetYear, targetMonth)) {
          const err = new Error(`Paid date must be within the selected month: ${formattedMonth}.`);
          err.statusCode = 400;
          throw err;
        }
      }

      const rawPaymentSource = req.body.paymentSource || {};
      const method = rawPaymentSource.method || "Cash";
      const paymentSource = {
        method,
        bankName: (method === "Bank Account" || method === "UPI") ? (rawPaymentSource.bankName || "") : "",
        last4Digits: method === "Bank Account" ? (rawPaymentSource.last4Digits || "") : "",
        upiId: method === "UPI" ? (rawPaymentSource.upiId || "") : "",
        otherDetails: method === "Other" ? (rawPaymentSource.otherDetails || "") : "",
      };

      const contribution = {
        amount: contributionAmount,
        dueDate: effectiveDueDate,
        paidDate: effectivePaidDate,
        status: contributionStatus,
        paymentSource,
        note: note || "",
      };

      if (!Array.isArray(investment.sipContributions)) {
        investment.sipContributions = [];
      }

      investment.sipContributions.push(contribution);
      
      if (contributionStatus === "Paid") {
        investment.amount = (Number(investment.amount) || 0) + contributionAmount;
        investment.totalContributions = (Number(investment.totalContributions) || 0) + contributionAmount;

        // Update type-specific quantities if provided in the contribution request
        if (investment.type === "Gold" && (req.body.weight || req.body.quantity)) {
          investment.weight = (Number(investment.weight) || 0) + Number(req.body.weight || req.body.quantity || 0);
        } else if (investment.type === "Mutual Fund" && (req.body.units || req.body.quantity)) {
          investment.units = (Number(investment.units) || 0) + Number(req.body.units || req.body.quantity || 0);
        } else if (investment.type === "Stocks" && req.body.quantity) {
          investment.quantity = (Number(investment.quantity) || 0) + Number(req.body.quantity || 0);
        }
      }
      
      await investment.save();

      await logActivity(userId, `Recorded ${investment.type} contribution of ₹${contributionAmount} for ${investment.name}`);

      const createdContribution = investment.sipContributions[investment.sipContributions.length - 1];

      return {
        contribution: createdContribution,
        investment,
        formattedMonth,
        contributionAmount,
        iso: monthCtx.iso,
        effectiveDueDate,
      };
    });

    return res.status(201).json({
      success: true,
      message: `${result.investment.type} contribution of ₹${result.contributionAmount.toLocaleString("en-IN")} recorded for ${result.formattedMonth}.`,
      contribution: result.contribution,
      investment: result.investment,
      selectedMonth: result.iso,
      derivedDueDate: formatDateISO(result.effectiveDueDate),
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Add SIP Contribution:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add SIP contribution.",
    });
  }
};

// ============================================================
// UPDATE SIP CONTRIBUTION
// ============================================================

const updateSIPContribution = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const result = await withUserPaymentLock(userId, async () => {
      const investment = await Investment.findOne({
        _id: req.params.id,
        user: userId,
      });

      if (!investment) {
        const notFoundErr = new Error("Investment not found.");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const contribution = investment.sipContributions.id(req.params.contributionId);
      if (!contribution) {
        const notFoundErr = new Error("SIP contribution not found.");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const { amount, dueDate, paidDate, status, note } = req.body;

      // --------------------------------------------------------
      // UPDATE AMOUNT
      // --------------------------------------------------------

      if (amount !== undefined) {
        const newAmount = Number(amount);
        if (!Number.isFinite(newAmount) || newAmount <= 0) {
          const err = new Error("Contribution amount must be a valid positive number.");
          err.code = "INVALID_AMOUNT";
          err.statusCode = 400;
          throw err;
        }
        contribution.amount = newAmount;
      }

      // --------------------------------------------------------
      // UPDATE DUE DATE
      // --------------------------------------------------------

      if (dueDate !== undefined) {
        contribution.dueDate = new Date(dueDate);
      }

      // --------------------------------------------------------
      // UPDATE STATUS
      // --------------------------------------------------------

      if (status !== undefined) {
        const allowedStatuses = ["Paid", "Not Paid", "Skipped"];
        if (!allowedStatuses.includes(status)) {
          const err = new Error("Invalid contribution status.");
          err.statusCode = 400;
          throw err;
        }

        if (status === "Paid" && contribution.status !== "Paid") {
          const monthCtx = parseSelectedMonth(req.body.selectedMonth || (paidDate ? String(paidDate).slice(0, 7) : null));
          await validateSufficientFunds({
            userId,
            year: monthCtx.year,
            month: monthCtx.month,
            requestedAmount: contribution.amount,
          });
        }

        contribution.status = status;

        if (status === "Paid") {
          contribution.paidDate = paidDate ? new Date(paidDate) : contribution.paidDate || new Date();
        } else {
          contribution.paidDate = null;
        }
      } else if (paidDate !== undefined) {
        contribution.paidDate = paidDate ? new Date(paidDate) : null;
      }

      // --------------------------------------------------------
      // UPDATE NOTE
      // --------------------------------------------------------

      if (note !== undefined) {
        contribution.note = note;
      }

      await investment.save();

      return { contribution, investment };
    });

    return res.status(200).json({
      success: true,
      message: "SIP contribution updated successfully.",
      contribution: result.contribution,
      investment: result.investment,
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Update SIP Contribution:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update SIP contribution.",
    });
  }
};

// ============================================================
// RECORD INVESTMENT MATURITY
// ============================================================

const recordInvestmentMaturity = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const investment = await Investment.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    const {
      actualMaturityValue: reqMaturityValue,
    } = req.body;

    // --------------------------------------------------------
    // CALCULATE TOTAL CONTRIBUTIONS
    // --------------------------------------------------------

    let totalContributions = 0;

    if (investment.type === "SIP") {
      totalContributions = (investment.sipContributions || [])
        .filter((contribution) => contribution.status === "Paid")
        .reduce((total, contribution) => total + Number(contribution.amount || 0), 0);
    } else {
      totalContributions = Number(
        investment.totalContributions ||
          investment.principalAmount ||
          investment.amount ||
          0
      );
    }

    const actualMaturityValue = Number(
      reqMaturityValue !== undefined ? reqMaturityValue : investment.currentValue || 0
    );

    // --------------------------------------------------------
    // CALCULATE GAIN / RETURN
    // --------------------------------------------------------

    const maturityGain = actualMaturityValue - totalContributions;

    // --------------------------------------------------------
    // SAVE MATURITY DATA
    // --------------------------------------------------------

    investment.totalContributions = totalContributions;
    investment.actualMaturityValue = actualMaturityValue;
    investment.maturityGain = maturityGain;
    investment.maturityRecordedAt = new Date();
    investment.currentValue = actualMaturityValue;
    investment.status = "Matured";
    investment.monthlyContribution = 0;
    investment.maturedAt = req.body.maturityDate ? new Date(req.body.maturityDate) : new Date();
    if (req.body.maturityDate) {
      investment.maturityDate = new Date(req.body.maturityDate);
    }
    investment.maturityAllocatedAmount = 0;
    investment.maturityRemainingAmount = actualMaturityValue;
    investment.maturityAllocationStatus = "Pending Allocation";
    if (!Array.isArray(investment.maturityAllocations)) {
      investment.maturityAllocations = [];
    }

    await investment.save();

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Investment maturity recorded successfully.",
      investment,
      maturitySummary: {
        totalContributions,
        actualMaturityValue,
        maturityGain,
      },
    });
  } catch (error) {
    console.error("Record Investment Maturity:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record investment maturity.",
    });
  }
};

// ============================================================
// RENEW INVESTMENT
// ============================================================

const renewInvestment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    // --------------------------------------------------------
    // FIND OLD INVESTMENT
    // --------------------------------------------------------

    const oldInvestment = await Investment.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!oldInvestment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    // --------------------------------------------------------
    // ONLY MATURED INVESTMENT CAN BE RENEWED
    // --------------------------------------------------------

    if (String(oldInvestment.status).toLowerCase() !== "matured") {
      return res.status(400).json({
        success: false,
        message: "Only a matured investment can be renewed.",
      });
    }

    // --------------------------------------------------------
    // REQUEST DATA
    // --------------------------------------------------------

    const {
      amount,
      principalAmount,
      contributionType,
      frequency,
      maturityDate,
    } = req.body;

    // --------------------------------------------------------
    // MATURITY AMOUNT & REMAINING TRACKING
    // --------------------------------------------------------

    const maturityAmount = Number(
      oldInvestment.actualMaturityValue ||
      oldInvestment.estimatedMaturityAmount ||
      oldInvestment.principalAmount ||
      oldInvestment.amount ||
      0
    );

    if (maturityAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Maturity amount must be greater than 0.",
      });
    }

    if (!oldInvestment.actualMaturityValue) {
      oldInvestment.actualMaturityValue = maturityAmount;
    }

    const prevAllocated = Number(oldInvestment.maturityAllocatedAmount || 0);
    const availableRemaining =
      oldInvestment.maturityRemainingAmount !== undefined &&
      oldInvestment.maturityRemainingAmount !== null
        ? Number(oldInvestment.maturityRemainingAmount)
        : Math.max(0, maturityAmount - prevAllocated);

    // --------------------------------------------------------
    // RENEWAL AMOUNT
    // --------------------------------------------------------

    const renewedAmount = Number(
      amount ??
      principalAmount ??
      availableRemaining
    );

    if (!Number.isFinite(renewedAmount) || renewedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Renewal amount must be greater than 0.",
      });
    }

    if (renewedAmount > availableRemaining + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Renewal amount (₹${Math.round(renewedAmount).toLocaleString("en-IN")}) cannot exceed remaining maturity amount (₹${Math.round(availableRemaining).toLocaleString("en-IN")}).`,
      });
    }

    // --------------------------------------------------------
    // CREATE NEW INVESTMENT
    // --------------------------------------------------------

    const newInvestment = await Investment.create({
      user: userId,
      name: oldInvestment.name,
      type: oldInvestment.type,
      amount: renewedAmount,
      contributionType: contributionType ?? oldInvestment.contributionType,
      frequency: frequency ?? oldInvestment.frequency,
      monthlyContribution: oldInvestment.monthlyContribution || 0,
      startDate: new Date(),
      nextContributionDate: oldInvestment.nextContributionDate,
      maturityDate: maturityDate ?? oldInvestment.maturityDate,
      status: "Active",
      currentValue: renewedAmount,
      institution: oldInvestment.institution,
      principalAmount: renewedAmount,
      interestRate: oldInvestment.interestRate,
      interestMethod: oldInvestment.interestMethod,
      interestPayoutFrequency: oldInvestment.interestPayoutFrequency,
      compoundingFrequency: oldInvestment.compoundingFrequency,
      estimatedInterest: 0,
      estimatedAnnualInterest: 0,
      estimatedInterestPerPayout: 0,
      estimatedMaturityAmount: 0,
      totalInterestReceived: 0,
      interestTransactions: [],
      renewedFromId: oldInvestment._id,
      renewedToId: null,
      renewalCount: Number(oldInvestment.renewalCount || 0) + 1,
      renewedAt: new Date(),
      maturedAt: null,
      closedAt: null,
      reminder: oldInvestment.reminder,
      maturityReminder: oldInvestment.maturityReminder,
    });

    // --------------------------------------------------------
    // UPDATE OLD INVESTMENT & LEDGER
    // --------------------------------------------------------

    const newAllocated = prevAllocated + renewedAmount;
    const newRemaining = Math.max(0, maturityAmount - newAllocated);
    const newStatus = newRemaining <= 0 ? "Fully Allocated" : "Partially Allocated";
    const isFull = renewedAmount >= availableRemaining - 0.01;

    oldInvestment.maturityAllocatedAmount = newAllocated;
    oldInvestment.maturityRemainingAmount = newRemaining;
    oldInvestment.maturityAllocationStatus = newStatus;
    oldInvestment.status = "Matured";
    oldInvestment.monthlyContribution = 0;
    if (!oldInvestment.maturedAt) {
      oldInvestment.maturedAt = oldInvestment.maturityDate || new Date();
    }
    oldInvestment.renewedToId = newInvestment._id;

    // Create Action Ledger Record
    const maturityAction = await InvestmentMaturityAction.create({
      user: userId,
      investment: oldInvestment._id,
      actionType: isFull ? "RENEW_FULL" : "RENEW_PARTIAL",
      maturityAmount,
      actionAmount: renewedAmount,
      remainingAmount: newRemaining,
      actionDate: new Date(),
      note: req.body.note || `Renewed ₹${renewedAmount} into ${newInvestment.name}`,
      investmentDetails: {
        newInvestmentId: newInvestment._id,
        investmentType: newInvestment.type,
        investmentName: newInvestment.name,
      },
    });

    if (!Array.isArray(oldInvestment.maturityAllocations)) {
      oldInvestment.maturityAllocations = [];
    }
    oldInvestment.maturityAllocations.push(maturityAction._id);
    await oldInvestment.save();

    await logActivity(
      userId,
      `Renewed ₹${renewedAmount} from matured investment ${oldInvestment.name} into ${newInvestment.name}`
    );

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Investment renewed successfully.",
      investment: newInvestment,
      oldInvestment,
      maturityAction,
      renewedFromId: oldInvestment._id,
      renewedToId: newInvestment._id,
    });
  } catch (error) {
    console.error("Renew Investment:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to renew investment.",
    });
  }
};

// ============================================================
// PROCESS INVESTMENT MATURITY ACTION
// ============================================================
const processInvestmentMaturityAction = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const { actionType, actionAmount, note, actionDate } = req.body;

    // 1. FIND OLD INVESTMENT
    const investment = await Investment.findOne({
      _id: id,
      user: userId,
    });

    if (!investment) {
      return res.status(404).json({
        success: false,
        message: "Investment not found.",
      });
    }

    // 2. DETERMINE TOTAL MATURITY AMOUNT
    const totalMaturity = Number(
      investment.actualMaturityValue ||
      investment.estimatedMaturityAmount ||
      investment.currentValue ||
      investment.principalAmount ||
      investment.amount ||
      0
    );

    if (totalMaturity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Actual maturity value is not recorded or must be greater than 0.",
      });
    }

    if (!investment.actualMaturityValue) {
      investment.actualMaturityValue = totalMaturity;
    }

    // 3. TRACK ALLOCATED & REMAINING
    const currentAllocated = Number(investment.maturityAllocatedAmount || 0);
    const currentRemaining =
      investment.maturityRemainingAmount !== undefined &&
      investment.maturityRemainingAmount !== null
        ? Number(investment.maturityRemainingAmount)
        : Math.max(0, totalMaturity - currentAllocated);

    if (currentRemaining <= 0) {
      return res.status(400).json({
        success: false,
        message: "This maturity amount has already been fully allocated.",
      });
    }

    // 4. VALIDATE ACTION AMOUNT
    const numActionAmount = Number(actionAmount);
    if (!Number.isFinite(numActionAmount) || numActionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid allocation amount greater than 0.",
      });
    }

    if (numActionAmount > currentRemaining + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Allocation amount (₹${Math.round(numActionAmount).toLocaleString("en-IN")}) cannot exceed remaining maturity amount (₹${Math.round(currentRemaining).toLocaleString("en-IN")}).`,
      });
    }

    // 5. PROCESS DESTINATION SPECIFIC ACTIONS
    const effectiveActionDate = actionDate ? new Date(actionDate) : new Date();
    const actionPayload = {
      user: userId,
      investment: investment._id,
      actionType: actionType || "KEEP_CASH",
      maturityAmount: totalMaturity,
      actionAmount: numActionAmount,
      actionDate: effectiveActionDate,
      note: note || "",
    };

    let updatedLiability = null;
    let createdNewInvestment = null;
    let additionalIncomeCreated = null;

    switch (actionType) {
      case "BANK_SAVINGS": {
        const bankName = String(req.body.bankName || "").trim();
        const accountLast4 = String(req.body.accountLast4 || "").trim();
        if (!bankName) {
          return res.status(400).json({
            success: false,
            message: "Bank name is required for Save in Bank.",
          });
        }
        if (!accountLast4 || !/^\d{4}$/.test(accountLast4)) {
          return res.status(400).json({
            success: false,
            message: "Valid last 4 digits of the account number are required.",
          });
        }
        actionPayload.bankDetails = { bankName, accountLast4 };
        break;
      }

      case "KEEP_CASH": {
        // Increases Available to Allocate via AdditionalIncome
        const addIncome = await AdditionalIncome.create({
          user: userId,
          title: `Maturity Proceeds (Cash) - ${investment.name}`,
          category: "Other",
          amount: numActionAmount,
          description: note || `Maturity cash allocation from ${investment.name}`,
          month: effectiveActionDate.getMonth() + 1,
          year: effectiveActionDate.getFullYear(),
          receivedDate: effectiveActionDate,
        });
        actionPayload.cashDetails = { additionalIncomeId: addIncome._id };
        additionalIncomeCreated = addIncome;
        break;
      }

      case "PURCHASE": {
        const itemName = String(req.body.itemName || "").trim();
        const category = String(req.body.category || "Other").trim();
        if (!itemName) {
          return res.status(400).json({
            success: false,
            message: "Item or purchase name is required.",
          });
        }
        actionPayload.purchaseDetails = { itemName, category };
        break;
      }

      case "PAY_LIABILITY": {
        const { liabilityId } = req.body;
        if (!liabilityId) {
          return res.status(400).json({
            success: false,
            message: "Please select an active liability to pay.",
          });
        }
        const liability = await Liability.findOne({ _id: liabilityId, user: userId });
        if (!liability) {
          return res.status(404).json({
            success: false,
            message: "Selected liability was not found.",
          });
        }
        const liabilityRemaining = Number(liability.remainingAmount || 0);
        if (numActionAmount > liabilityRemaining + 0.01) {
          return res.status(400).json({
            success: false,
            message: `Payment amount (₹${Math.round(numActionAmount).toLocaleString("en-IN")}) cannot exceed outstanding liability (₹${Math.round(liabilityRemaining).toLocaleString("en-IN")}).`,
          });
        }

        const paymentRecord = {
          amount: numActionAmount,
          dueDate: effectiveActionDate,
          paidDate: effectiveActionDate,
          date: effectiveActionDate,
          status: "Paid",
          type: "Prepayment",
          principalComponent: numActionAmount,
          interestComponent: 0,
          paymentSource: {
            method: "Other",
            otherDetails: `Maturity Proceeds (${investment.name})`,
          },
          note: note || `Paid from maturity proceeds of ${investment.name}`,
        };

        if (!Array.isArray(liability.payments)) {
          liability.payments = [];
        }
        liability.payments.push(paymentRecord);
        liability.remainingAmount = Math.max(0, liabilityRemaining - numActionAmount);
        if (liability.remainingAmount <= 0) {
          liability.status = "Completed";
        }
        await liability.save();
        updatedLiability = liability;

        actionPayload.liabilityDetails = {
          liabilityId: liability._id,
          liabilityName: liability.name,
          paymentId: liability.payments[liability.payments.length - 1]._id,
        };
        break;
      }

      case "NEW_INVESTMENT":
      case "RENEW_FULL":
      case "RENEW_PARTIAL": {
        const newInvType = req.body.investmentType || req.body.newInvestmentType || investment.type || "Other";
        const newInvName = req.body.investmentName || req.body.newInvestmentName || `${investment.name} (Reinvested)`;

        const newInv = await Investment.create({
          user: userId,
          name: newInvName,
          type: newInvType,
          amount: numActionAmount,
          principalAmount: numActionAmount,
          currentValue: numActionAmount,
          monthlyContribution: 0,
          startDate: effectiveActionDate,
          maturityDate: req.body.newMaturityDate ? new Date(req.body.newMaturityDate) : null,
          status: "Active",
          institution: req.body.institution || investment.institution || "",
          interestRate: Number(req.body.interestRate || investment.interestRate || 0),
          interestMethod: req.body.interestMethod || investment.interestMethod || undefined,
          paymentSource: "Other",
          paymentSourceDetails: {
            otherDetails: `Maturity Proceeds (${investment.name})`,
          },
          renewedFromId: investment._id,
          reminder: investment.reminder,
          maturityReminder: investment.maturityReminder,
        });

        investment.renewedToId = newInv._id;
        createdNewInvestment = newInv;

        actionPayload.investmentDetails = {
          newInvestmentId: newInv._id,
          investmentType: newInv.type,
          investmentName: newInv.name,
        };
        break;
      }

      case "OTHER":
      default: {
        actionPayload.otherDetails = {
          description: String(req.body.description || note || "Other allocation").trim(),
          category: String(req.body.category || "Other").trim(),
        };
        break;
      }
    }

    // 6. UPDATE REMAINING & TOTAL ALLOCATED
    const newAllocated = currentAllocated + numActionAmount;
    const newRemaining = Math.max(0, totalMaturity - newAllocated);
    const newStatus = newRemaining <= 0 ? "Fully Allocated" : "Partially Allocated";

    actionPayload.remainingAmount = newRemaining;

    // 7. CREATE ACTION LEDGER RECORD
    const maturityAction = await InvestmentMaturityAction.create(actionPayload);

    // 8. UPDATE INVESTMENT RECORD
    investment.status = "Matured";
    investment.monthlyContribution = 0;
    investment.actualMaturityValue = totalMaturity;
    investment.maturityAllocatedAmount = newAllocated;
    investment.maturityRemainingAmount = newRemaining;
    investment.maturityAllocationStatus = newStatus;
    if (!investment.maturedAt) {
      investment.maturedAt = investment.maturityDate || new Date();
    }
    if (!Array.isArray(investment.maturityAllocations)) {
      investment.maturityAllocations = [];
    }
    investment.maturityAllocations.push(maturityAction._id);
    await investment.save();

    // 9. LOG ACTIVITY
    await logActivity(
      userId,
      `Allocated ₹${numActionAmount} of maturity proceeds from ${investment.name} to ${actionType}`
    );

    return res.status(200).json({
      success: true,
      message: "Maturity action processed successfully.",
      maturityAction,
      investment,
      liability: updatedLiability,
      newInvestment: createdNewInvestment,
      additionalIncome: additionalIncomeCreated,
      allocationSummary: {
        maturityAmount: totalMaturity,
        totalAllocated: newAllocated,
        remainingAmount: newRemaining,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Process Investment Maturity Action:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process maturity action.",
    });
  }
};

// ============================================================
// GET INVESTMENT MATURITY ALLOCATIONS (LEDGER)
// ============================================================
const getInvestmentMaturityAllocations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const investment = await Investment.findOne({ _id: id, user: userId });
    if (!investment) {
      return res.status(404).json({ success: false, message: "Investment not found." });
    }

    const allocations = await InvestmentMaturityAction.find({
      investment: investment._id,
      user: userId,
    }).sort({ actionDate: -1, createdAt: -1 });

    const totalMaturity = Number(
      investment.actualMaturityValue ||
      investment.currentValue ||
      investment.estimatedMaturityAmount ||
      investment.amount ||
      0
    );
    const totalAllocated = Number(investment.maturityAllocatedAmount || 0);
    const remainingAmount = Number(
      investment.maturityRemainingAmount !== undefined && investment.maturityRemainingAmount !== null
        ? investment.maturityRemainingAmount
        : Math.max(0, totalMaturity - totalAllocated)
    );

    return res.status(200).json({
      success: true,
      investment,
      maturityAmount: totalMaturity,
      totalAllocated,
      remainingAmount,
      status:
        investment.maturityAllocationStatus ||
        (remainingAmount <= 0 && totalAllocated > 0 ? "Fully Allocated" : "Pending Allocation"),
      allocations,
    });
  } catch (error) {
    console.error("Get Maturity Allocations:", error);
    return res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
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
};