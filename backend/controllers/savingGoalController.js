// ============================================================
// FINANCEOS - SAVING GOAL CONTROLLER
// ============================================================

const SavingGoal = require("../models/SavingGoal");
const MonthlyFinance = require("../models/MonthlyFinance");
const {
  validateSufficientFunds,
  withUserPaymentLock,
  handleFundsError,
  parsePeriod,
} = require("../utils/fundValidationService");

// Helper to get or create current monthly finance
const getCurrentMonthlyFinance = async (userId) => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  let finance = await MonthlyFinance.findOne({
    user: userId,
    month,
    year,
  });

  return finance;
};

// ============================================================
// ADD SAVING GOAL
// ============================================================

const addSavingGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      goalName,
      category = "Other",
      targetAmount,
      startDate,
      targetDate,
      notes = "",
      fundLocation = {},
      reminder = {},
      initialContributionSource = "Existing Savings",
    } = req.body;

    const numericTarget = Number(targetAmount);
    if (!numericTarget || numericTarget <= 0) {
      return res.status(400).json({
        success: false,
        message: "Target amount must be greater than 0.",
      });
    }

    if (!goalName || !goalName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Goal name is required.",
      });
    }

    const initialSaved = Number(
      req.body.initialContribution !== undefined
        ? req.body.initialContribution
        : (req.body.alreadySaved !== undefined
            ? req.body.alreadySaved
            : (req.body.savedAmount !== undefined ? req.body.savedAmount : 0))
    );

    if (!Number.isFinite(initialSaved) || initialSaved < 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "Initial contribution amount must be zero or a valid positive number.",
      });
    }

    let finance = await getCurrentMonthlyFinance(userId);

    // If initial contribution > 0, verify affordability under user concurrency lock
    if (initialSaved > 0) {
      return await withUserPaymentLock(userId, async () => {
        const period = parsePeriod(
          req.body.selectedMonth,
          req.body.initialContributionDate || startDate
        );

        await validateSufficientFunds({
          userId,
          year: period.year,
          month: period.month,
          requestedAmount: initialSaved,
        });

        const contributions = [
          {
            amount: initialSaved,
            date: req.body.initialContributionDate || startDate || new Date(),
            source: initialContributionSource || "Existing Savings",
            note: "Initial contribution at goal creation",
            fundLocation: fundLocation,
            createdAt: new Date(),
          },
        ];

        const goalStatus =
          initialSaved >= numericTarget
            ? "Completed"
            : (req.body.status || "Active");

        const goal = await SavingGoal.create({
          user: userId,
          goalName: goalName.trim(),
          category,
          targetAmount: numericTarget,
          alreadySaved: initialSaved,
          currentAmount: initialSaved,
          monthlyContribution: Number(req.body.monthlyContribution || 0),
          startDate: startDate || new Date(),
          targetDate: targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: goalStatus,
          notes: notes.trim(),
          fundLocation,
          initialContributionDate: req.body.initialContributionDate || startDate,
          initialContributionSource,
          contributions,
          withdrawals: [],
          reminder,
        });

        if (finance) {
          finance.goalAllocations = Number(finance.goalAllocations || 0) + initialSaved;
          finance.closingBalance =
            (finance.openingBalance || finance.cashBalance || 0) +
            finance.monthlySavings -
            finance.goalAllocations -
            (finance.commitments || 0);
          await finance.save();
        }

        return res.status(201).json({
          success: true,
          message: "Saving goal created successfully.",
          goal,
          financialSummary: {
            availableToAllocate: finance ? finance.availableToAllocate : null,
          },
        });
      });
    }

    // Initial contribution is 0: create goal without locking or consuming funds
    const goalStatus = req.body.status || "Active";
    const goal = await SavingGoal.create({
      user: userId,
      goalName: goalName.trim(),
      category,
      targetAmount: numericTarget,
      alreadySaved: 0,
      currentAmount: 0,
      monthlyContribution: Number(req.body.monthlyContribution || 0),
      startDate: startDate || new Date(),
      targetDate: targetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: goalStatus,
      notes: notes.trim(),
      fundLocation,
      initialContributionDate: null,
      initialContributionSource,
      contributions: [],
      withdrawals: [],
      reminder,
    });

    return res.status(201).json({
      success: true,
      message: "Saving goal created successfully.",
      goal,
      financialSummary: {
        availableToAllocate: finance ? finance.availableToAllocate : null,
      },
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    console.error("Add Saving Goal Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create saving goal.",
    });
  }
};

// ============================================================
// GET ALL SAVING GOALS
// ============================================================

const getSavingGoals = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goals = await SavingGoal.find({
      user: userId,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: goals.length,
      goals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SINGLE SAVING GOAL
// ============================================================

const getSavingGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await SavingGoal.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    res.status(200).json({
      success: true,
      goal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// UPDATE SAVING GOAL (TARGET, DATES, STATUS, ETC)
// ============================================================

const updateSavingGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await SavingGoal.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    if (req.body.goalName !== undefined) goal.goalName = req.body.goalName.trim();
    if (req.body.category !== undefined) goal.category = req.body.category;
    if (req.body.targetAmount !== undefined) {
      const newTarget = Number(req.body.targetAmount);
      if (newTarget > 0) goal.targetAmount = newTarget;
    }
    if (req.body.monthlyContribution !== undefined) {
      goal.monthlyContribution = Number(req.body.monthlyContribution);
    }
    if (req.body.startDate !== undefined) goal.startDate = req.body.startDate;
    if (req.body.targetDate !== undefined) goal.targetDate = req.body.targetDate;
    if (req.body.status !== undefined) goal.status = req.body.status;
    if (req.body.notes !== undefined) goal.notes = req.body.notes;
    if (req.body.fundLocation !== undefined) {
      goal.fundLocation = { ...goal.fundLocation, ...req.body.fundLocation };
    }
    if (req.body.reminder !== undefined) {
      goal.reminder = { ...goal.reminder, ...req.body.reminder };
    }

    // Auto-update status if target reached
    const totalContributed = goal.totalContributed || goal.currentAmount || 0;
    if (goal.targetAmount > 0 && totalContributed >= goal.targetAmount && goal.status === "Active") {
      goal.status = "Completed";
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: "Saving goal updated successfully.",
      goal,
    });
  } catch (error) {
    console.error("Update Saving Goal Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const { isItemActiveInMonth, parseSelectedMonth, isDateInMonth, getMonthName } = require("../utils/monthLifecycle");

// ============================================================
// ADD GOAL CONTRIBUTION
// ============================================================

const addGoalContribution = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      amount,
      date,
      source = "Monthly Savings",
      note = "",
      paymentDetails = {},
      fundLocation,
      selectedMonth: reqSelectedMonth
    } = req.body;

    const contributionAmount = Number(amount);
    if (!contributionAmount || contributionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Contribution amount must be greater than 0.",
      });
    }

    const goal = await SavingGoal.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    if (goal.status === "Closed") {
      return res.status(400).json({
        success: false,
        message: "This saving goal is closed.",
      });
    }

    // Determine target working month context
    const monthCtx = parseSelectedMonth(reqSelectedMonth || (date ? date.slice(0, 7) : null));
    const targetYear = monthCtx.year;
    const targetMonth = monthCtx.month;
    const formattedMonth = `${getMonthName(targetMonth)} ${targetYear}`;

    // 1. Strict month validation: If date provided, must belong to target month
    const effectiveDate = date ? new Date(date) : new Date(monthCtx.defaultDate);
    if (Number.isNaN(effectiveDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid contribution date format.",
      });
    }

    if (reqSelectedMonth && !isDateInMonth(effectiveDate, targetYear, targetMonth)) {
      return res.status(400).json({
        success: false,
        message: `Contribution date must be within the selected month: ${formattedMonth}.`,
      });
    }

    // 2. Lifecycle check: Goal must have existed on or before target month
    if (!isItemActiveInMonth(goal, targetYear, targetMonth)) {
      const goalStart = new Date(goal.startDate || goal.createdAt);
      const startMonthName = getMonthName(goalStart.getMonth() + 1);
      return res.status(400).json({
        success: false,
        message: `Cannot record contribution in ${formattedMonth}. This goal was created in ${startMonthName} ${goalStart.getFullYear()}.`,
      });
    }

    return await withUserPaymentLock(userId, async () => {
      // Validate sufficient funds against authoritative cash flow calculation
      await validateSufficientFunds({
        userId,
        year: targetYear,
        month: targetMonth,
        requestedAmount: contributionAmount,
      });

      // 3. Find or initialize MonthlyFinance for the targeted working month
      let finance = await MonthlyFinance.findOne({
        user: userId,
        month: targetMonth,
        year: targetYear,
      });

      if (!finance) {
        finance = await MonthlyFinance.create({
          user: userId,
          month: targetMonth,
          year: targetYear,
          income: 0,
          expenses: 0,
          openingBalance: 0,
          cashBalance: 0,
          closingBalance: 0,
          goalAllocations: 0,
          commitments: 0,
        });
      }

      // Record contribution with the validated date
      const newContribution = {
        amount: contributionAmount,
        date: effectiveDate,
        source: source || "Monthly Savings",
        note: note.trim(),
        paymentDetails: paymentDetails || {},
        fundLocation: fundLocation || goal.fundLocation || {},
        createdAt: new Date(),
      };

      if (!Array.isArray(goal.contributions)) {
        goal.contributions = [];
      }

      goal.contributions.push(newContribution);
      goal.currentAmount = (goal.currentAmount || 0) + contributionAmount;

      // Check goal completion
      if (goal.currentAmount >= goal.targetAmount) {
        goal.status = "Completed";
      }

      await goal.save();

      // Deduct contribution from target month's MonthlyFinance
      if (finance) {
        finance.goalAllocations = Number(finance.goalAllocations || 0) + contributionAmount;
        finance.closingBalance =
          (finance.openingBalance || finance.cashBalance || 0) +
          finance.monthlySavings -
          finance.goalAllocations -
          (finance.commitments || 0);
        await finance.save();
      }

      return res.status(200).json({
        success: true,
        message: `Contribution of ₹${contributionAmount.toLocaleString("en-IN")} recorded for ${formattedMonth}.`,
        goal,
        selectedMonth: monthCtx.iso,
        contribution: newContribution,
        financialSummary: {
          availableToAllocate: finance ? finance.availableToAllocate : null,
        },
      });
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    console.error("Add Goal Contribution Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// UPDATE GOAL CONTRIBUTION
// ============================================================

const updateGoalContribution = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id, contributionId } = req.params;
    const { amount, date, source, note, paymentDetails, fundLocation } = req.body;

    const goal = await SavingGoal.findOne({
      _id: id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    const contribution = goal.contributions.id(contributionId);
    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: "Contribution record not found.",
      });
    }

    const oldAmount = Number(contribution.amount || 0);
    const newAmount = amount !== undefined ? Number(amount) : oldAmount;
    const diff = newAmount - oldAmount;

    return await withUserPaymentLock(userId, async () => {
      // If increasing contribution, verify affordability
      if (diff > 0) {
        const period = parsePeriod(req.body.selectedMonth, date || contribution.date);
        await validateSufficientFunds({
          userId,
          year: period.year,
          month: period.month,
          requestedAmount: diff,
        });
      }

      let finance = await getCurrentMonthlyFinance(userId);

      if (amount !== undefined) contribution.amount = newAmount;
      if (date !== undefined) contribution.date = date;
      if (source !== undefined) contribution.source = source;
      if (note !== undefined) contribution.note = note.trim();
      if (paymentDetails !== undefined) contribution.paymentDetails = paymentDetails;
      if (fundLocation !== undefined) contribution.fundLocation = fundLocation;

      goal.currentAmount = Math.max(0, (goal.currentAmount || 0) + diff);

      if (goal.currentAmount >= goal.targetAmount) {
        goal.status = "Completed";
      } else if (goal.status === "Completed") {
        goal.status = "Active";
      }

      await goal.save();

      if (diff !== 0 && finance) {
        finance.goalAllocations = Math.max(0, Number(finance.goalAllocations || 0) + diff);
        finance.closingBalance =
          (finance.openingBalance || finance.cashBalance || 0) +
          finance.monthlySavings -
          finance.goalAllocations -
          (finance.commitments || 0);
        await finance.save();
      }

      return res.status(200).json({
        success: true,
        message: "Contribution updated successfully.",
        goal,
        financialSummary: {
          availableToAllocate: finance ? finance.availableToAllocate : null,
        },
      });
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    console.error("Update Goal Contribution Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DELETE GOAL CONTRIBUTION
// ============================================================

const deleteGoalContribution = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id, contributionId } = req.params;

    const goal = await SavingGoal.findOne({
      _id: id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    const contribution = goal.contributions.id(contributionId);
    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: "Contribution record not found.",
      });
    }

    const removedAmount = Number(contribution.amount || 0);
    goal.contributions.pull(contributionId);
    goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - removedAmount);

    if (goal.status === "Completed" && goal.currentAmount < goal.targetAmount) {
      goal.status = "Active";
    }

    await goal.save();

    let finance = await getCurrentMonthlyFinance(userId);
    if (finance && removedAmount > 0) {
      finance.goalAllocations = Math.max(0, Number(finance.goalAllocations || 0) - removedAmount);
      finance.closingBalance =
        (finance.openingBalance || finance.cashBalance || 0) +
        finance.monthlySavings -
        finance.goalAllocations -
        (finance.commitments || 0);
      await finance.save();
    }

    res.status(200).json({
      success: true,
      message: "Contribution removed successfully.",
      goal,
      financialSummary: {
        availableToAllocate: finance ? finance.availableToAllocate : null,
      },
    });
  } catch (error) {
    console.error("Delete Goal Contribution Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// WITHDRAW GOAL FUNDS
// ============================================================

const withdrawGoalFunds = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { amount, date, purpose = "", note = "" } = req.body;

    const withdrawalAmount = Number(amount);
    if (!withdrawalAmount || withdrawalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal amount must be greater than 0.",
      });
    }

    const goal = await SavingGoal.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    if (goal.status === "Closed") {
      return res.status(400).json({
        success: false,
        message: "This saving goal is already closed.",
      });
    }

    const availableFund = goal.availableGoalFund;
    if (withdrawalAmount > availableFund) {
      return res.status(400).json({
        success: false,
        message: `Requested ₹${withdrawalAmount.toLocaleString("en-IN")} exceeds available goal fund of ₹${availableFund.toLocaleString("en-IN")}.`,
      });
    }

    if (!Array.isArray(goal.withdrawals)) {
      goal.withdrawals = [];
    }

    goal.withdrawals.push({
      amount: withdrawalAmount,
      date: date || new Date(),
      purpose: purpose.trim(),
      note: note.trim(),
      createdAt: new Date(),
    });

    // If fully withdrawn after achievement, can mark Closed
    if (goal.availableGoalFund - withdrawalAmount <= 0 && goal.status === "Completed") {
      goal.status = "Closed";
    }

    await goal.save();

    res.status(200).json({
      success: true,
      message: "Goal funds withdrawal recorded successfully.",
      goal,
    });
  } catch (error) {
    console.error("Withdraw Goal Funds Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DELETE SAVING GOAL
// ============================================================

const deleteSavingGoal = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const goal = await SavingGoal.findOne({
      _id: req.params.id,
      user: userId,
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: "Saving goal not found.",
      });
    }

    // If goal had contributions in the current month, refund them in monthly finance
    let finance = await getCurrentMonthlyFinance(userId);
    if (finance && goal.currentAmount > 0) {
      finance.goalAllocations = Math.max(0, Number(finance.goalAllocations || 0) - (goal.currentAmount || 0));
      finance.closingBalance =
        (finance.openingBalance || finance.cashBalance || 0) +
        finance.monthlySavings -
        finance.goalAllocations -
        (finance.commitments || 0);
      await finance.save();
    }

    await goal.deleteOne();

    res.status(200).json({
      success: true,
      message: "Saving goal deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Saving Goal Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  addSavingGoal,
  getSavingGoals,
  getSavingGoal,
  updateSavingGoal,
  addGoalContribution,
  updateGoalContribution,
  deleteGoalContribution,
  withdrawGoalFunds,
  deleteSavingGoal,
};