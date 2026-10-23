// ============================================================
// FINANCEOS - AUTHORITATIVE CASH FLOW BREAKDOWN ENGINE
// ============================================================
//
// Single source of truth for:
// - Existing / Opening Balance Calculation & Provenance
// - Monthly Inflows (Base Income + Additional Income)
// - Total Funds Available Before Outflows
// - Actual Cash Outflows (Living Expenses + Actual Paid Contributions/Payments)
// - Closing Balance & Available to Allocate
// - Dynamic Natural-Language Explanation
// ============================================================

const MonthlyFinance = require("../models/MonthlyFinance");
const AdditionalIncome = require("../models/AdditionalIncome");
const Investment = require("../models/Investment");
const Insurance = require("../models/Insurance");
const Liability = require("../models/Liability");
const SavingGoal = require("../models/SavingGoal");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Checks if a date falls within the specified year and month.
 */
function isDateInPeriod(dateVal, targetYear, targetMonth) {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
}

/**
 * Calculates the complete, authoritative cash flow breakdown for a user and month.
 */
async function calculateMonthlyCashFlowBreakdown({ userId, year, month }) {
  const targetYear = Number(year);
  const targetMonth = Number(month);
  const monthName = MONTH_NAMES[targetMonth - 1] || `Month ${targetMonth}`;
  const monthLabel = `${monthName} ${targetYear}`;
  const monthISO = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

  // 1. Fetch target month's MonthlyFinance record
  const currentRecord = await MonthlyFinance.findOne({
    user: userId,
    year: targetYear,
    month: targetMonth,
  });

  // 2. Determine Opening Balance & Provenance
  // Determine previous month period
  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = targetYear - 1;
  }
  const prevMonthName = MONTH_NAMES[prevMonth - 1];
  const prevMonthLabel = `${prevMonthName} ${prevYear}`;
  const prevMonthISO = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  // Look for immediate previous month record
  const previousMonthRecord = await MonthlyFinance.findOne({
    user: userId,
    year: prevYear,
    month: prevMonth,
  });

  // Also check if any earlier record exists anywhere prior to this month
  const anyPriorRecord = await MonthlyFinance.findOne({
    user: userId,
    $or: [
      { year: { $lt: targetYear } },
      { year: targetYear, month: { $lt: targetMonth } },
    ],
  }).sort({ year: -1, month: -1 });

  let openingBalanceAmount = 0;
  let sourceType = "initial_setup";
  let sourceDescription = "User-entered starting cash & savings balance";
  let previousMonthClosingBalance = null;
  let hasPreviousMonth = false;
  let openingAdjustment = 0;
  let hasOpeningAdjustment = false;

  if (previousMonthRecord) {
    hasPreviousMonth = true;
    previousMonthClosingBalance = safeNum(
      previousMonthRecord.closingBalance !== undefined
        ? previousMonthRecord.closingBalance
        : previousMonthRecord.cashBalance
    );
    sourceType = "previous_month_closing";
    sourceDescription = `Carried forward from ${prevMonthLabel} closing balance`;
    openingBalanceAmount = previousMonthClosingBalance;

    // Check if current record has an intentional adjustment
    if (currentRecord) {
      const recordedOpening = safeNum(
        currentRecord.openingBalance !== undefined
          ? currentRecord.openingBalance
          : currentRecord.cashBalance
      );
      if (Math.abs(recordedOpening - previousMonthClosingBalance) > 0.01) {
        openingAdjustment = recordedOpening - previousMonthClosingBalance;
        hasOpeningAdjustment = true;
        openingBalanceAmount = recordedOpening;
      }
    }
  } else if (anyPriorRecord) {
    // Carried from the most recent previous recorded month
    hasPreviousMonth = true;
    const priorMonthName = MONTH_NAMES[anyPriorRecord.month - 1];
    const priorMonthLabel = `${priorMonthName} ${anyPriorRecord.year}`;
    previousMonthClosingBalance = safeNum(
      anyPriorRecord.closingBalance !== undefined
        ? anyPriorRecord.closingBalance
        : anyPriorRecord.cashBalance
    );
    sourceType = "prior_month_closing";
    sourceDescription = `Carried forward from ${priorMonthLabel} closing balance`;
    openingBalanceAmount = previousMonthClosingBalance;

    if (currentRecord) {
      const recordedOpening = safeNum(
        currentRecord.openingBalance !== undefined
          ? currentRecord.openingBalance
          : currentRecord.cashBalance
      );
      if (Math.abs(recordedOpening - previousMonthClosingBalance) > 0.01) {
        openingAdjustment = recordedOpening - previousMonthClosingBalance;
        hasOpeningAdjustment = true;
        openingBalanceAmount = recordedOpening;
      }
    }
  } else {
    // Initial month setup
    sourceType = "initial_setup";
    sourceDescription = "Initial user-entered starting balance";
    if (currentRecord) {
      openingBalanceAmount = safeNum(
        currentRecord.openingBalance !== undefined
          ? currentRecord.openingBalance
          : currentRecord.cashBalance
      );
    }
  }

  // 3. Inflows: Base Income + Additional Income
  const baseIncome = currentRecord ? safeNum(currentRecord.income) : 0;
  const additionalIncomes = await AdditionalIncome.find({
    user: userId,
    year: targetYear,
    month: targetMonth,
  }).sort({ date: 1 });

  const additionalIncomeTotal = additionalIncomes.reduce(
    (sum, item) => sum + safeNum(item.amount),
    0
  );
  const totalIncome = baseIncome + additionalIncomeTotal;

  // 4. Funds Available Before Outflows
  const fundsBeforeOutflows = openingBalanceAmount + totalIncome;

  // 5. Living Expenses
  const expenses = currentRecord ? safeNum(currentRecord.expenses) : 0;

  // 6. Actual Outflows from Connected Models in Target Month
  const [allInvestments, allInsurances, allLiabilities, allSavingGoals] = await Promise.all([
    Investment.find({ user: userId }),
    Insurance.find({ user: userId }),
    Liability.find({ user: userId }),
    SavingGoal.find({ user: userId }),
  ]);

  // A. Actual Investment Contributions
  let actualInvestmentContributions = 0;
  let plannedInvestmentsExpected = 0;
  const investmentDetails = [];

  allInvestments.forEach((inv) => {
    let invPaidThisMonth = 0;
    let invPaidCount = 0;

    if (Array.isArray(inv.sipContributions)) {
      inv.sipContributions.forEach((sc) => {
        const scDate = sc.paidDate || sc.dueDate;
        if (isDateInPeriod(scDate, targetYear, targetMonth)) {
          if (sc.status === "Paid") {
            const amt = safeNum(sc.amount);
            actualInvestmentContributions += amt;
            invPaidThisMonth += amt;
            invPaidCount++;
          }
        }
      });
    }

    if (Array.isArray(inv.transactions)) {
      inv.transactions.forEach((tx) => {
        if ((tx.type === "Buy" || tx.type === "Additional Investment") && isDateInPeriod(tx.date, targetYear, targetMonth)) {
          const amt = safeNum(tx.amount);
          actualInvestmentContributions += amt;
          invPaidThisMonth += amt;
          invPaidCount++;
        }
      });
    }

    // Support Fixed Deposit and One-Time investments when not recorded in transactions
    const hasBuyTx = Array.isArray(inv.transactions) && inv.transactions.some(tx => (tx.type === "Buy" || tx.type === "Additional Investment") && isDateInPeriod(tx.date, targetYear, targetMonth));
    if (!hasBuyTx && (inv.type === "Fixed Deposit" || inv.contributionType === "One Time" || inv.contributionType === "One-Time")) {
      const invDate = inv.startDate || inv.createdAt;
      if (isDateInPeriod(invDate, targetYear, targetMonth)) {
        const amt = safeNum(inv.principalAmount || inv.amount);
        if (amt > 0) {
          actualInvestmentContributions += amt;
          invPaidThisMonth += amt;
          invPaidCount++;
        }
      }
    }

    // Planned commitment for context (active in this month)
    if (inv.status === "Active") {
      plannedInvestmentsExpected += safeNum(inv.monthlyContribution || (inv.type === "SIP" ? inv.amount : 0));
    }

    if (invPaidCount > 0) {
      investmentDetails.push({
        id: inv._id,
        name: inv.name,
        type: inv.type,
        amount: invPaidThisMonth,
        count: invPaidCount,
      });
    }
  });

  // B. Actual Goal Contributions
  let actualGoalContributions = 0;
  let plannedGoalsExpected = 0;
  const goalDetails = [];

  allSavingGoals.forEach((goal) => {
    let goalPaidThisMonth = 0;
    let goalPaidCount = 0;

    const txs = Array.isArray(goal.contributions)
      ? goal.contributions
      : Array.isArray(goal.transactions)
      ? goal.transactions
      : [];

    txs.forEach((tx) => {
      const txDate = tx.date || tx.createdAt;
      if (isDateInPeriod(txDate, targetYear, targetMonth)) {
        const amt = safeNum(tx.amount);
        actualGoalContributions += amt;
        goalPaidThisMonth += amt;
        goalPaidCount++;
      }
    });

    if (goal.status === "Active") {
      plannedGoalsExpected += safeNum(goal.monthlyContribution);
    }

    if (goalPaidCount > 0) {
      goalDetails.push({
        id: goal._id,
        name: goal.name,
        amount: goalPaidThisMonth,
        count: goalPaidCount,
      });
    }
  });

  // C. Actual Insurance Payments
  let actualInsurancePayments = 0;
  let plannedInsuranceExpected = 0;
  const insuranceDetails = [];

  allInsurances.forEach((ins) => {
    let insPaidThisMonth = 0;
    let insPaidCount = 0;

    if (Array.isArray(ins.payments)) {
      ins.payments.forEach((p) => {
        const pDate = p.paidDate || p.dueDate || p.date;
        if (isDateInPeriod(pDate, targetYear, targetMonth)) {
          if (p.status === "Paid" || p.paid) {
            const amt = safeNum(p.amount);
            actualInsurancePayments += amt;
            insPaidThisMonth += amt;
            insPaidCount++;
          }
        }
      });
    }

    if (ins.status === "Active") {
      plannedInsuranceExpected += safeNum(ins.monthlyEquivalent || ins.premiumAmount);
    }

    if (insPaidCount > 0) {
      insuranceDetails.push({
        id: ins._id,
        name: ins.name,
        amount: insPaidThisMonth,
        count: insPaidCount,
      });
    }
  });

  // D. Actual Liability Payments
  let actualLiabilityPayments = 0;
  let plannedLiabilitiesExpected = 0;
  const liabilityDetails = [];

  allLiabilities.forEach((liab) => {
    let liabPaidThisMonth = 0;
    let liabPaidCount = 0;

    if (Array.isArray(liab.payments)) {
      liab.payments.forEach((p) => {
        const pDate = p.paidDate || p.dueDate || p.date;
        if (isDateInPeriod(pDate, targetYear, targetMonth)) {
          if (p.status === "Paid" || p.paid) {
            // Check if this payment was funded from maturity proceeds (capital transfer, not monthly income outflow)
            const isMaturityFunded =
              p.paymentSource?.method === "Maturity Proceeds" ||
              (p.paymentSource?.otherDetails && String(p.paymentSource.otherDetails).includes("Maturity Proceeds")) ||
              p.fundedFrom === "Maturity Proceeds";

            if (!isMaturityFunded) {
              const amt = safeNum(p.amount);
              actualLiabilityPayments += amt;
              liabPaidThisMonth += amt;
              liabPaidCount++;
            }
          }
        }
      });
    }

    if (liab.status === "Active" && safeNum(liab.remainingAmount) > 0) {
      plannedLiabilitiesExpected += safeNum(liab.monthlyEMI || liab.minimumDue);
    }

    if (liabPaidCount > 0) {
      liabilityDetails.push({
        id: liab._id,
        name: liab.name,
        amount: liabPaidThisMonth,
        count: liabPaidCount,
      });
    }
  });

  // E. Total Actual Outflows
  const otherOutflows = 0;
  const totalActualOutflows =
    expenses +
    actualInvestmentContributions +
    actualGoalContributions +
    actualInsurancePayments +
    actualLiabilityPayments +
    otherOutflows;

  // 7. Closing Balance & Available to Allocate
  const calculatedClosing = fundsBeforeOutflows - totalActualOutflows;
  const closingBalance = calculatedClosing;
  const availableToAllocate = calculatedClosing;

  // Monthly Savings (Operating Cash Flow)
  const monthlySavings = totalIncome - expenses;

  // Unpaid Commitments Summary
  const unpaidInvestments = Math.max(0, plannedInvestmentsExpected - actualInvestmentContributions);
  const unpaidGoals = Math.max(0, plannedGoalsExpected - actualGoalContributions);
  const unpaidInsurance = Math.max(0, plannedInsuranceExpected - actualInsurancePayments);
  const unpaidLiabilities = Math.max(0, plannedLiabilitiesExpected - actualLiabilityPayments);
  const totalUnpaidCommitments = unpaidInvestments + unpaidGoals + unpaidInsurance + unpaidLiabilities;

  // 8. Natural Language Explanation
  const fmt = (v) => `₹${Math.round(v).toLocaleString("en-IN")}`;
  let explanation = "";

  if (sourceType === "previous_month_closing") {
    explanation = `Your ${monthLabel} Available to Allocate is ${fmt(availableToAllocate)}. You started the month with ${fmt(openingBalanceAmount)} carried forward from ${prevMonthLabel} closing balance, received ${fmt(totalIncome)} of total income, and had ${fmt(totalActualOutflows)} of actual recorded cash outflows during the month.`;
  } else if (sourceType === "prior_month_closing") {
    explanation = `Your ${monthLabel} Available to Allocate is ${fmt(availableToAllocate)}. You started the month with ${fmt(openingBalanceAmount)} carried forward from prior recorded balances, received ${fmt(totalIncome)} of total income, and had ${fmt(totalActualOutflows)} of actual recorded cash outflows.`;
  } else {
    explanation = `Your ${monthLabel} Available to Allocate is ${fmt(availableToAllocate)}. You started with ${fmt(openingBalanceAmount)} in initial existing cash and savings, received ${fmt(totalIncome)} of total income, and had ${fmt(totalActualOutflows)} of actual recorded cash outflows.`;
  }

  return {
    month: monthISO,
    year: targetYear,
    monthNumber: targetMonth,
    monthName,
    monthLabel,
    hasRecord: !!currentRecord,

    // Opening Balance & Provenance
    openingBalance: {
      amount: openingBalanceAmount,
      sourceType,
      sourceDescription,
      previousMonth: hasPreviousMonth ? (previousMonthRecord ? prevMonthISO : `${anyPriorRecord.year}-${String(anyPriorRecord.month).padStart(2, "0")}`) : null,
      previousMonthLabel: hasPreviousMonth ? (previousMonthRecord ? prevMonthLabel : `${MONTH_NAMES[anyPriorRecord.month - 1]} ${anyPriorRecord.year}`) : null,
      previousMonthClosingBalance,
      hasAdjustment: hasOpeningAdjustment,
      adjustmentAmount: openingAdjustment,
    },

    // Inflows
    inflow: {
      baseIncome,
      additionalIncome: additionalIncomeTotal,
      totalIncome,
      additionalIncomeCount: additionalIncomes.length,
      additionalIncomes: additionalIncomes.map((ai) => ({
        id: ai._id,
        title: ai.title,
        amount: safeNum(ai.amount),
        category: ai.category,
      })),
    },

    // Total Funds Available Before Outflows
    fundsBeforeOutflows,

    // Outflows (ONLY actual financial outflows)
    outflows: {
      expenses,
      investments: actualInvestmentContributions,
      hasInvestments: actualInvestmentContributions > 0,
      investmentDetails,

      goalContributions: actualGoalContributions,
      hasGoals: actualGoalContributions > 0,
      goalDetails,

      insurancePayments: actualInsurancePayments,
      hasInsurance: actualInsurancePayments > 0,
      insuranceDetails,

      liabilityPayments: actualLiabilityPayments,
      hasLiabilities: actualLiabilityPayments > 0,
      liabilityDetails,

      other: otherOutflows,
      hasOther: otherOutflows > 0,

      totalActualOutflows,
    },

    // Commitments Context (Expected vs Paid)
    commitmentsContext: {
      plannedInvestmentsExpected,
      actualInvestmentContributions,
      unpaidInvestments,

      plannedGoalsExpected,
      actualGoalContributions,
      unpaidGoals,

      plannedInsuranceExpected,
      actualInsurancePayments,
      unpaidInsurance,

      plannedLiabilitiesExpected,
      actualLiabilityPayments,
      unpaidLiabilities,

      totalPlannedExpected: plannedInvestmentsExpected + plannedGoalsExpected + plannedInsuranceExpected + plannedLiabilitiesExpected,
      totalActualPaid: actualInvestmentContributions + actualGoalContributions + actualInsurancePayments + actualLiabilityPayments,
      totalUnpaidCommitments,
    },

    // Balances
    monthlySavings,
    closingBalance,
    availableToAllocate,

    // Natural Language Explanation
    explanation,
  };
}

module.exports = {
  calculateMonthlyCashFlowBreakdown,
  safeNum,
  MONTH_NAMES,
};
