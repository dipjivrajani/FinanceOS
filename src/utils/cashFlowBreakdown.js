// ============================================================
// FINANCEOS - FRONTEND CASH FLOW BREAKDOWN UTILITY
// ============================================================
//
// Matches backend logic exactly. Computes:
// 1. Opening Balance Provenance
// 2. Inflows
// 3. Funds Before Outflows
// 4. Actual Cash Outflows (Investments, Goals, Insurance, Liabilities, Expenses)
// 5. Available to Allocate & Closing Balance
// 6. Natural-Language Dynamic Explanation
// ============================================================

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function safeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function formatINR(val, fallback = "₹0") {
  const n = safeNumber(val);
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Checks if a date falls in specified year and month.
 */
export function isDateInPeriod(dateVal, targetYear, targetMonth) {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
}

/**
 * Pure function to derive the cash flow breakdown in the frontend.
 */
export function deriveCashFlowBreakdown({
  monthlyFinance = {},
  previousMonthRecord = null,
  investments = [],
  savingGoals = [],
  insurancePolicies = [],
  liabilities = [],
  additionalIncomes = [],
  selectedYear,
  selectedMonth,
  backendBreakdown = null,
}) {
  const targetYear = Number(selectedYear || monthlyFinance.year || new Date().getFullYear());
  const targetMonth = Number(selectedMonth || monthlyFinance.month || (new Date().getMonth() + 1));
  const monthName = MONTH_NAMES[targetMonth - 1] || `Month ${targetMonth}`;
  const monthLabel = `${monthName} ${targetYear}`;
  const monthISO = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

  // If backend provided detailed breakdown, use it as baseline but overlay active state
  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = targetYear - 1;
  }
  const prevMonthName = MONTH_NAMES[prevMonth - 1];
  const prevMonthLabel = `${prevMonthName} ${prevYear}`;
  const prevMonthISO = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  // 1. Opening Balance
  let openingBalanceAmount = 0;
  let sourceType = "initial_setup";
  let sourceDescription = "User-entered starting cash & savings balance";
  let previousMonthClosingBalance = null;
  let hasPreviousMonth = false;
  let openingAdjustment = 0;
  let hasOpeningAdjustment = false;

  if (backendBreakdown?.openingBalance) {
    openingBalanceAmount = safeNumber(backendBreakdown.openingBalance.amount);
    sourceType = backendBreakdown.openingBalance.sourceType;
    sourceDescription = backendBreakdown.openingBalance.sourceDescription;
    previousMonthClosingBalance = backendBreakdown.openingBalance.previousMonthClosingBalance;
    hasPreviousMonth = !!backendBreakdown.openingBalance.previousMonth;
    hasOpeningAdjustment = !!backendBreakdown.openingBalance.hasAdjustment;
    openingAdjustment = safeNumber(backendBreakdown.openingBalance.adjustmentAmount);
  } else if (previousMonthRecord) {
    hasPreviousMonth = true;
    previousMonthClosingBalance = safeNumber(
      previousMonthRecord.closingBalance !== undefined
        ? previousMonthRecord.closingBalance
        : previousMonthRecord.cashBalance
    );
    sourceType = "previous_month_closing";
    sourceDescription = `Carried forward from ${prevMonthLabel} closing balance`;
    openingBalanceAmount = previousMonthClosingBalance;

    const currentOpening = safeNumber(
      monthlyFinance.openingBalance !== undefined
        ? monthlyFinance.openingBalance
        : monthlyFinance.cashBalance
    );
    if (Math.abs(currentOpening - previousMonthClosingBalance) > 0.01) {
      openingAdjustment = currentOpening - previousMonthClosingBalance;
      hasOpeningAdjustment = true;
      openingBalanceAmount = currentOpening;
    }
  } else {
    openingBalanceAmount = safeNumber(
      monthlyFinance.openingBalance !== undefined
        ? monthlyFinance.openingBalance
        : monthlyFinance.cashBalance
    );
    sourceType = "initial_setup";
    sourceDescription = "Initial user-entered starting balance";
  }

  // 2. Inflows
  const baseIncome = safeNumber(monthlyFinance.income);
  const activeAdditional = (additionalIncomes || []).filter((ai) => {
    if (ai.year && ai.month) return ai.year === targetYear && ai.month === targetMonth;
    return isDateInPeriod(ai.date || ai.createdAt, targetYear, targetMonth);
  });
  const additionalIncomeTotal = activeAdditional.reduce((sum, ai) => sum + safeNumber(ai.amount), 0);
  const totalIncome = baseIncome + additionalIncomeTotal;

  // 3. Funds Available Before Outflows
  const fundsBeforeOutflows = openingBalanceAmount + totalIncome;

  // 4. Living Expenses
  const expenses = safeNumber(monthlyFinance.expenses);

  // 5. Actual Outflows
  // A. Investments
  let actualInvestmentContributions = 0;
  let plannedInvestmentsExpected = 0;
  const investmentDetails = [];

  (investments || []).forEach((inv) => {
    let paidAmt = 0;
    let count = 0;
    if (Array.isArray(inv.sipContributions)) {
      inv.sipContributions.forEach((sc) => {
        const scDate = sc.paidDate || sc.dueDate;
        if (isDateInPeriod(scDate, targetYear, targetMonth) && sc.status === "Paid") {
          const a = safeNumber(sc.amount);
          actualInvestmentContributions += a;
          paidAmt += a;
          count++;
        }
      });
    }
    if (Array.isArray(inv.transactions)) {
      inv.transactions.forEach((tx) => {
        if ((tx.type === "Buy" || tx.type === "Additional Investment") && isDateInPeriod(tx.date, targetYear, targetMonth)) {
          const a = safeNumber(tx.amount);
          actualInvestmentContributions += a;
          paidAmt += a;
          count++;
        }
      });
    }
    const hasBuyTx = Array.isArray(inv.transactions) && inv.transactions.some((tx) => (tx.type === "Buy" || tx.type === "Additional Investment") && isDateInPeriod(tx.date, targetYear, targetMonth));
    if (!hasBuyTx && (inv.type === "Fixed Deposit" || inv.contributionType === "One Time" || inv.contributionType === "One-Time")) {
      const invDate = inv.startDate || inv.createdAt;
      if (isDateInPeriod(invDate, targetYear, targetMonth)) {
        const a = safeNumber(inv.principalAmount || inv.amount);
        if (a > 0) {
          actualInvestmentContributions += a;
          paidAmt += a;
          count++;
        }
      }
    }
    if (inv.status === "Active") {
      plannedInvestmentsExpected += safeNumber(inv.monthlyContribution || (inv.type === "SIP" ? inv.amount : 0));
    }
    if (count > 0) {
      investmentDetails.push({
        id: inv.id || inv._id,
        name: inv.name,
        type: inv.type,
        amount: paidAmt,
        count,
      });
    }
  });

  // B. Goals
  let actualGoalContributions = 0;
  let plannedGoalsExpected = 0;
  const goalDetails = [];

  (savingGoals || []).forEach((goal) => {
    let paidAmt = 0;
    let count = 0;
    const txs = Array.isArray(goal.contributions)
      ? goal.contributions
      : Array.isArray(goal.transactions)
      ? goal.transactions
      : [];

    txs.forEach((tx) => {
      const txDate = tx.date || tx.createdAt;
      if (isDateInPeriod(txDate, targetYear, targetMonth)) {
        const a = safeNumber(tx.amount);
        actualGoalContributions += a;
        paidAmt += a;
        count++;
      }
    });

    if (goal.status === "Active") {
      plannedGoalsExpected += safeNumber(goal.monthlyContribution);
    }

    if (count > 0) {
      goalDetails.push({
        id: goal.id || goal._id,
        name: goal.name || goal.goalName,
        amount: paidAmt,
        count,
      });
    }
  });

  // C. Insurance
  let actualInsurancePayments = 0;
  let plannedInsuranceExpected = 0;
  const insuranceDetails = [];

  (insurancePolicies || []).forEach((ins) => {
    let paidAmt = 0;
    let count = 0;
    if (Array.isArray(ins.payments)) {
      ins.payments.forEach((p) => {
        const pDate = p.paidDate || p.dueDate || p.date;
        if (isDateInPeriod(pDate, targetYear, targetMonth) && (p.status === "Paid" || p.paid)) {
          const a = safeNumber(p.amount);
          actualInsurancePayments += a;
          paidAmt += a;
          count++;
        }
      });
    }
    if (ins.status === "Active") {
      plannedInsuranceExpected += safeNumber(ins.monthlyEquivalent || ins.premiumAmount);
    }
    if (count > 0) {
      insuranceDetails.push({
        id: ins.id || ins._id,
        name: ins.name,
        amount: paidAmt,
        count,
      });
    }
  });

  // D. Liabilities
  let actualLiabilityPayments = 0;
  let plannedLiabilitiesExpected = 0;
  const liabilityDetails = [];

  (liabilities || []).forEach((liab) => {
    let paidAmt = 0;
    let count = 0;
    if (Array.isArray(liab.payments)) {
      liab.payments.forEach((p) => {
        const pDate = p.paidDate || p.dueDate || p.date;
        if (isDateInPeriod(pDate, targetYear, targetMonth) && (p.status === "Paid" || p.paid)) {
          const a = safeNumber(p.amount);
          actualLiabilityPayments += a;
          paidAmt += a;
          count++;
        }
      });
    }
    if (liab.status === "Active" && safeNumber(liab.remainingAmount) > 0) {
      plannedLiabilitiesExpected += safeNumber(liab.monthlyEMI || liab.minimumDue);
    }
    if (count > 0) {
      liabilityDetails.push({
        id: liab.id || liab._id,
        name: liab.name,
        amount: paidAmt,
        count,
      });
    }
  });

  const otherOutflows = 0;
  const totalActualOutflows =
    expenses +
    actualInvestmentContributions +
    actualGoalContributions +
    actualInsurancePayments +
    actualLiabilityPayments +
    otherOutflows;

  // 6. Net Savings, Closing & Available
  const monthlySavings = totalIncome - expenses;
  const calculatedClosing = fundsBeforeOutflows - totalActualOutflows;
  const closingBalance = calculatedClosing;
  const availableToAllocate = calculatedClosing;

  // Unpaid Commitments Summary
  const unpaidInvestments = Math.max(0, plannedInvestmentsExpected - actualInvestmentContributions);
  const unpaidGoals = Math.max(0, plannedGoalsExpected - actualGoalContributions);
  const unpaidInsurance = Math.max(0, plannedInsuranceExpected - actualInsurancePayments);
  const unpaidLiabilities = Math.max(0, plannedLiabilitiesExpected - actualLiabilityPayments);
  const totalUnpaidCommitments = unpaidInvestments + unpaidGoals + unpaidInsurance + unpaidLiabilities;

  // 7. Explanation
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

    // Opening Balance
    openingBalance: {
      amount: openingBalanceAmount,
      sourceType,
      sourceDescription,
      previousMonth: hasPreviousMonth ? prevMonthISO : null,
      previousMonthLabel: hasPreviousMonth ? prevMonthLabel : null,
      previousMonthClosingBalance,
      hasAdjustment: hasOpeningAdjustment,
      adjustmentAmount: openingAdjustment,
    },

    // Inflows
    inflow: {
      baseIncome,
      additionalIncome: additionalIncomeTotal,
      totalIncome,
      additionalIncomeCount: activeAdditional.length,
      additionalIncomes: activeAdditional,
    },

    fundsBeforeOutflows,

    // Outflows
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

    // Commitments Context
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

    monthlySavings,
    closingBalance,
    availableToAllocate,

    explanation,
  };
}
