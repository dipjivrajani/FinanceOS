const Liability = require("../models/Liability");
const Activity = require("../models/Activity");
const Reminder = require("../models/Reminder");
const User = require("../models/User");

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

const createLiability = async (req, res) => {
  try {
    if (req.body.reminder?.channels?.sms === true) {
      return res.status(400).json({
        success: false,
        message: "SMS notifications are not supported. FinanceOS supports only Email and In-App notifications.",
      });
    }
    const userId = req.user?.id || req.user?._id;
    const liabilityData = { ...req.body, user: userId };
    
    // Normalize aliases
    if (!liabilityData.name && liabilityData.title) liabilityData.name = liabilityData.title;
    if (!liabilityData.type && liabilityData.liabilityType) liabilityData.type = liabilityData.liabilityType;
    if (liabilityData.principalAmount === undefined && liabilityData.totalLoanAmount !== undefined) {
      liabilityData.principalAmount = Number(liabilityData.totalLoanAmount);
    }

    // Set initial remaining amount if not provided
    if (liabilityData.remainingAmount === undefined) {
      liabilityData.remainingAmount = liabilityData.principalAmount;
    }

    const liability = await Liability.create(liabilityData);

    await logActivity(userId, `Added a new liability: ${liability.name}`);

    res.status(201).json({
      success: true,
      message: "Liability created successfully.",
      liability,
    });
  } catch (error) {
    console.error("Create Liability:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

const getLiabilities = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const liabilities = await Liability.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      liabilities,
    });
  } catch (error) {
    console.error("Get Liabilities:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

const updateLiability = async (req, res) => {
  try {
    if (req.body.reminder?.channels?.sms === true) {
      return res.status(400).json({
        success: false,
        message: "SMS notifications are not supported. FinanceOS supports only Email and In-App notifications.",
      });
    }
    const userId = req.user?.id || req.user?._id;
    const liability = await Liability.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!liability) {
      return res.status(404).json({ success: false, message: "Liability not found." });
    }

    await logActivity(userId, `Updated liability: ${liability.name}`);

    res.status(200).json({
      success: true,
      message: "Liability updated successfully.",
      liability,
    });
  } catch (error) {
    console.error("Update Liability:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

const deleteLiability = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const liability = await Liability.findOneAndDelete({ _id: req.params.id, user: userId });

    if (!liability) {
      return res.status(404).json({ success: false, message: "Liability not found." });
    }

    await Reminder.deleteMany({ referenceId: req.params.id });

    await logActivity(userId, `Deleted liability: ${liability.name}`);

    res.status(200).json({
      success: true,
      message: "Liability deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Liability:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

const { isItemActiveInMonth, parseSelectedMonth, isDateInMonth, getMonthName } = require("../utils/monthLifecycle");
const { calculateDueDateForMonth, formatDateISO } = require("../utils/dueDateSchedule");
const MonthlyFinance = require("../models/MonthlyFinance");
const {
  validateSufficientFunds,
  withUserPaymentLock,
  handleFundsError,
} = require("../utils/fundValidationService");

const addLiabilityPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const result = await withUserPaymentLock(userId, async () => {
      const liability = await Liability.findOne({ _id: req.params.id, user: userId });

      if (!liability) {
        const notFoundErr = new Error("Liability not found.");
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const {
        amount,
        paidDate,
        status,
        type, // EMI, Prepayment, Closure
        principalComponent,
        interestComponent,
        paymentSource,
        note,
        closureDetails,
        selectedMonth: reqSelectedMonth
      } = req.body;
      
      const paymentAmount = Number(amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        const err = new Error("Valid payment amount is required.");
        err.code = "INVALID_AMOUNT";
        err.statusCode = 400;
        throw err;
      }

      // Determine target working month context
      const monthCtx = parseSelectedMonth(reqSelectedMonth || (paidDate ? String(paidDate).slice(0, 7) : null));
      const targetYear = monthCtx.year;
      const targetMonth = monthCtx.month;
      const formattedMonth = `${getMonthName(targetMonth)} ${targetYear}`;

      // 1. Lifecycle check: Liability must have started on or before target month
      if (!isItemActiveInMonth(liability, targetYear, targetMonth)) {
        const liabStart = new Date(liability.startDate || liability.createdAt);
        const startMonthName = getMonthName(liabStart.getMonth() + 1);
        const err = new Error(`Cannot record payment in ${formattedMonth}. This liability started in ${startMonthName} ${liabStart.getFullYear()}.`);
        err.statusCode = 400;
        throw err;
      }

      // Check sufficient funds if marking as Paid
      if (status === "Paid" || !status) {
        await validateSufficientFunds({
          userId,
          year: targetYear,
          month: targetMonth,
          requestedAmount: paymentAmount,
        });
      }

      // --------------------------------------------------------
      // DERIVE DUE DATE FROM STORED SCHEDULE (server-side only)
      // --------------------------------------------------------
      const storedDueDay = liability.dueDay
        || (liability.nextDueDate ? new Date(liability.nextDueDate).getDate() : null)
        || 5; // fallback

      const effectiveDueDate = calculateDueDateForMonth(storedDueDay, targetYear, targetMonth);

      const effectivePaidDate = status === "Paid" || !status
        ? (paidDate ? new Date(paidDate) : new Date())
        : null;

      // Validate paid date belongs to selected month
      if (reqSelectedMonth && effectivePaidDate) {
        if (!isDateInMonth(effectivePaidDate, targetYear, targetMonth)) {
          const err = new Error(`Payment date must be within the selected month: ${formattedMonth}.`);
          err.statusCode = 400;
          throw err;
        }
      }

      const payment = {
        amount: paymentAmount,
        dueDate: effectiveDueDate,
        paidDate: effectivePaidDate,
        date: effectivePaidDate || effectiveDueDate,
        status: status || "Paid",
        type: type || "EMI",
        principalComponent: principalComponent || 0,
        interestComponent: interestComponent || 0,
        paymentSource: paymentSource || { method: "Cash" },
        note: note || "",
      };

      if (!Array.isArray(liability.payments)) {
        liability.payments = [];
      }

      liability.payments.push(payment);

      // Apply financial adjustments based on transaction type
      if (payment.type === "Closure") {
        liability.remainingAmount = 0;
        liability.status = "Closed";
        if (closureDetails) {
          liability.closureDetails = {
            closureDate: closureDetails.closureDate ? new Date(closureDetails.closureDate) : new Date(),
            amountPaid: Number(closureDetails.amountPaid) || paymentAmount,
            outstandingAtClosure: Number(closureDetails.outstandingAtClosure) || 0,
            penaltyCharges: Number(closureDetails.penaltyCharges) || 0,
            note: closureDetails.note || note || ""
          };
        }
      } else {
        // EMI or Prepayment
        const deduction = payment.type === "Prepayment" 
          ? paymentAmount 
          : (payment.principalComponent > 0 ? payment.principalComponent : paymentAmount);

        liability.remainingAmount = Math.max(0, (liability.remainingAmount || 0) - deduction);
        
        if (liability.remainingAmount <= 0) {
          liability.status = "Completed";
        }
      }

      await liability.save();

      await logActivity(
        userId,
        `Recorded ${payment.type} of ₹${paymentAmount} for liability: ${liability.name}. New Outstanding: ₹${liability.remainingAmount}`
      );

      return { liability, payment, formattedMonth };
    });

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully.",
      liability: result.liability,
      payment: result.payment,
    });
  } catch (error) {
    if (handleFundsError(res, error)) return;
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("Add Liability Payment:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = {
  createLiability,
  getLiabilities,
  updateLiability,
  deleteLiability,
  addLiabilityPayment,
};
