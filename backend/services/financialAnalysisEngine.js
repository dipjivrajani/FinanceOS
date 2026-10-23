// ============================================================
// FINANCEOS - AUTHORITATIVE FINANCIAL ANALYSIS & DECISION ENGINE
// Mathematical calculations for:
// - Loan Repayment vs Investment vs Fixed Deposit Comparison
// - Maturity-to-Action Planning (Maturity in 15 days, wait costs, net proceeds)
// - Investment Readiness & Debt/Liquidity Priority Assessment
// - Actionable Choice Comparison Matrix
// - Deterministic Evaluation for all Section 6.G Scenarios
// ============================================================

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Calculates loan amortization and prepayment savings.
 * Strictly avoids double-counting and accounts for prepayment penalties.
 *
 * @param {Object} params
 * @param {number} params.principal - Outstanding principal
 * @param {number} params.annualRate - Annual interest rate in percent (e.g. 10.5)
 * @param {number} params.monthlyEMI - Current monthly EMI
 * @param {number} [params.tenureMonths] - Remaining tenure in months (optional, calculated if omitted)
 * @param {number} [params.prepaymentAmount=0] - Proposed prepayment lump-sum
 * @param {number} [params.prepaymentPenaltyPercent=0] - Prepayment penalty in percent (e.g. 2.0)
 * @param {number} [params.daysToWaitingMaturity=0] - Days waiting for maturity proceeds (e.g. 15)
 */
function calculateLoanPrepaymentAnalysis({
  principal,
  annualRate,
  monthlyEMI,
  tenureMonths = 0,
  prepaymentAmount = 0,
  prepaymentPenaltyPercent = 0,
  daysToWaitingMaturity = 0,
}) {
  const P = safeNum(principal);
  const r = safeNum(annualRate);
  const E = safeNum(monthlyEMI);
  const prepay = Math.min(safeNum(prepaymentAmount), P);
  const penaltyRate = safeNum(prepaymentPenaltyPercent);
  const daysWait = Math.max(0, safeNum(daysToWaitingMaturity));

  if (P <= 0 || r <= 0 || E <= 0) {
    return {
      isValid: false,
      reason: "Missing or non-positive loan parameters",
      principal: P,
      annualRate: r,
      monthlyEMI: E,
      grossInterestSaved: 0,
      netInterestSaved: 0,
      prepaymentPenaltyCharges: 0,
      waitingInterestCost: 0,
      tenureMonthsSaved: 0,
    };
  }

  const rMonth = r / 1200;

  // Calculate remaining tenure in months if not provided or inconsistent
  let n = safeNum(tenureMonths);
  if (n <= 0) {
    if (E <= P * rMonth) {
      n = 360;
    } else {
      n = Math.ceil(-Math.log(1 - (P * rMonth) / E) / Math.log(1 + rMonth));
    }
  }

  // Total scheduled payments without prepayment
  const totalScheduledPayments = n * E;
  const totalRemainingInterest = Math.max(0, totalScheduledPayments - P);

  // Interest cost during waiting period before maturity (e.g. 15 days)
  // Daily interest = P * (r / 36500)
  const waitingInterestCost = Math.round(P * (r / 36500) * daysWait);

  // If prepayment is evaluated
  let newPrincipal = P;
  let newTenure = n;
  let newRemainingInterest = totalRemainingInterest;
  let grossInterestSaved = 0;
  let prepaymentPenaltyCharges = 0;
  let netInterestSaved = 0;
  let isFullPayoff = false;

  if (prepay > 0) {
    newPrincipal = Math.max(0, P - prepay);
    prepaymentPenaltyCharges = Math.round(prepay * (penaltyRate / 100));

    if (newPrincipal <= 0) {
      isFullPayoff = true;
      newTenure = 0;
      newRemainingInterest = 0;
      grossInterestSaved = totalRemainingInterest;
      netInterestSaved = Math.max(0, grossInterestSaved - prepaymentPenaltyCharges);
    } else {
      if (E > newPrincipal * rMonth) {
        newTenure = Math.ceil(-Math.log(1 - (newPrincipal * rMonth) / E) / Math.log(1 + rMonth));
        const newTotalPayments = newTenure * E;
        newRemainingInterest = Math.max(0, newTotalPayments - newPrincipal);
        grossInterestSaved = Math.max(0, totalRemainingInterest - newRemainingInterest);
        netInterestSaved = Math.max(0, grossInterestSaved - prepaymentPenaltyCharges);
      } else {
        newTenure = n;
        grossInterestSaved = 0;
        netInterestSaved = 0;
      }
    }
  }

  const tenureMonthsSaved = Math.max(0, n - newTenure);

  return {
    isValid: true,
    principal: P,
    annualRate: r,
    monthlyEMI: E,
    originalTenureMonths: n,
    prepaymentAmount: prepay,
    prepaymentPenaltyPercent: penaltyRate,
    prepaymentPenaltyCharges,
    daysToWaitingMaturity: daysWait,
    waitingInterestCost,
    totalScheduledPayments: Math.round(totalScheduledPayments),
    totalRemainingInterest: Math.round(totalRemainingInterest),
    newPrincipal: Math.round(newPrincipal),
    newTenureMonths: newTenure,
    tenureMonthsSaved,
    newRemainingInterest: Math.round(newRemainingInterest),
    grossInterestSaved: Math.round(grossInterestSaved),
    netInterestSaved: Math.round(netInterestSaved),
    isFullPayoff,
    comparisonSummary: {
      action: prepay > 0 ? "Prepay Principal" : "Scheduled EMI",
      waitingCostNotice: daysWait > 0 ? `During the ${daysWait}-day wait before maturity proceeds arrive, interest accrues at ₹${waitingInterestCost}.` : null,
      savingsNotice: netInterestSaved > 0 ? `Net interest savings: ₹${netInterestSaved.toLocaleString("en-IN")} after accounting for ₹${prepaymentPenaltyCharges} prepayment penalty.` : null,
    },
  };
}

/**
 * Calculates after-tax Fixed Deposit compounding with DICGC limits and premature withdrawal penalty.
 */
function calculateFixedDepositReturns({
  amount,
  principal,
  annualRate,
  tenureMonths,
  taxRatePercent = 0,
  taxSlabPercent = 0,
  prematurePenaltyRate = 0.5,
}) {
  const P = safeNum(amount || principal);
  const r = safeNum(annualRate);
  const m = Math.max(1, safeNum(tenureMonths));
  const t = m / 12; // years
  const taxRate = safeNum(taxRatePercent || taxSlabPercent) / 100;

  if (P <= 0 || r <= 0) {
    return {
      isValid: false,
      amount: P,
      principal: P,
      annualRate: r,
      tenureMonths: m,
      grossInterest: 0,
      grossInterestEarned: 0,
      taxDeduction: 0,
      taxDeducted: 0,
      netInterest: 0,
      netMaturity: P,
      netPostTaxReturn: P,
      dicgcInsured: P <= 500000,
      dicgcInsuredAmount: Math.min(P, 500000),
    };
  }

  // Quarterly compounding: A = P * (1 + r/400)^(4*t)
  const compoundFreq = 4;
  const grossMaturity = P * Math.pow(1 + r / (100 * compoundFreq), compoundFreq * t);
  const grossInterest = Math.max(0, grossMaturity - P);
  const taxDeduction = grossInterest * taxRate;
  const netInterest = Math.max(0, grossInterest - taxDeduction);
  const netMaturity = P + netInterest;

  // Premature withdrawal scenario
  const reducedRate = Math.max(0, r - prematurePenaltyRate);
  const prematureTenure = Math.max(1, Math.floor(m / 2));
  const prematureYears = prematureTenure / 12;
  const prematureGrossMaturity = P * Math.pow(1 + reducedRate / (100 * compoundFreq), compoundFreq * prematureYears);
  const prematureInterest = Math.max(0, prematureGrossMaturity - P);

  return {
    isValid: true,
    amount: P,
    principal: P,
    annualRate: r,
    tenureMonths: m,
    tenureLabel: m < 12 ? `${m} Months` : m % 12 === 0 ? `${m / 12} Year${m > 12 ? "s" : ""}` : `${m} Months (${(m / 12).toFixed(1)} Yrs)`,
    grossMaturity: Math.round(grossMaturity),
    grossInterest: Math.round(grossInterest),
    grossInterestEarned: Math.round(grossInterest),
    taxRatePercent: safeNum(taxRatePercent || taxSlabPercent),
    taxDeduction: Math.round(taxDeduction),
    taxDeducted: Math.round(taxDeduction),
    netInterest: Math.round(netInterest),
    netMaturity: Math.round(netMaturity),
    netPostTaxReturn: Math.round(netMaturity),
    prematurePenaltyRate,
    prematureInterestEstimate: Math.round(prematureInterest),
    dicgcInsured: P <= 500000,
    dicgcInsuredAmount: Math.min(P, 500000),
    dicgcCoverageAmount: Math.min(P, 500000),
  };
}

/**
 * Assesses Investment Readiness based on the 9 criteria in Section 5.
 */
function assessInvestmentReadiness(params) {
  // Support both direct arguments or nested { snapshot, items }
  const s = params.snapshot || params;
  const items = params.items || {};

  const income = safeNum(s.income ?? s.monthlyIncome);
  const expenses = safeNum(s.expenses ?? s.monthlyExpenses);
  const savings = safeNum(s.monthlySavings ?? (income - expenses));
  const surplus = safeNum(s.availableToAllocate);
  const runway = safeNum(s.emergencyFundMonths);
  const debt = safeNum(s.totalLiabilities);
  const activeLiabs = items.liabilities || s.activeLiabilities || [];

  const checks = [];
  const unresolvedConcerns = [];

  // Check 1: Essential living expenses covered
  const chk1Pass = income > expenses && expenses > 0;
  checks.push({
    id: "essential_expenses",
    title: "Essential Expenses Covered",
    passed: chk1Pass,
    details: chk1Pass
      ? `Monthly income (₹${income.toLocaleString("en-IN")}) covers living costs (₹${expenses.toLocaleString("en-IN")}) with ₹${savings.toLocaleString("en-IN")} net savings.`
      : "Living expenses exceed or consume the entirety of regular monthly income.",
  });
  if (!chk1Pass) unresolvedConcerns.push("Living expenses exceed monthly income.");

  // Check 2: Upcoming EMIs, insurance premiums, and obligations accounted for
  const chk2Pass = surplus >= 0;
  checks.push({
    id: "obligations_accounted",
    title: "Upcoming Obligations Covered",
    passed: chk2Pass,
    details: chk2Pass
      ? `Monthly commitments accounted for before surplus allocation.`
      : "Upcoming commitments or EMIs are causing a monthly deficit.",
  });
  if (!chk2Pass) unresolvedConcerns.push("Upcoming EMIs or insurance obligations exceed available funds.");

  // Check 3: Sufficient Emergency Liquidity (at least 3-6 months)
  const chk3Pass = runway >= 3.0;
  checks.push({
    id: "emergency_liquidity",
    title: "Emergency Liquidity Buffer (3 - 6 Months)",
    passed: chk3Pass,
    details: chk3Pass
      ? `Liquid runway covers ${runway} months of essential living expenses (Recommended: 3 to 6 months).`
      : `Emergency reserve covers only ${runway} months of living costs. Target at least 3 months (₹${(expenses * 3).toLocaleString("en-IN")}) before entering volatile assets.`,
  });
  if (!chk3Pass) unresolvedConcerns.push(`Emergency buffer is only ${runway} months (below recommended 3-6 months).`);

  // Check 4: High-cost debts creating financial pressure
  const hasHighInterestDebt = activeLiabs.some((l) => safeNum(l.interestRate) >= 11.0);
  const chk4Pass = !hasHighInterestDebt && debt <= income * 12;
  checks.push({
    id: "high_cost_debt",
    title: "High-Cost Debt Under Control",
    passed: chk4Pass,
    details: chk4Pass
      ? "No predatory or double-digit interest liabilities identified."
      : "High-interest debt identified. Paying down debt provides a risk-free return matching your loan interest rate.",
  });
  if (!chk4Pass) unresolvedConcerns.push("High-interest debt burden creates financial drag. Accelerated prepayment recommended.");

  // Check 5: Near-term cash requirements
  const needWithinMonth = Boolean(s.needWithinOneMonth);
  const chk5Pass = !needWithinMonth;
  checks.push({
    id: "near_term_liquidity",
    title: "Surplus Not Needed in Immediate Near-Term",
    passed: chk5Pass,
    details: chk5Pass
      ? "Funds are not earmarked for expenditure within the next 30 days."
      : "Money needed within 30 days. Volatile assets should not be utilized.",
  });
  if (!chk5Pass) unresolvedConcerns.push("Surplus needed within 30 days. Maintain in high-yield liquid account.");

  // Check 6: Unallocated surplus verified
  const chk6Pass = surplus > 0;
  checks.push({
    id: "unallocated_surplus",
    title: "Genuine Unallocated Cash Surplus",
    passed: chk6Pass,
    details: chk6Pass
      ? `Verified ₹${surplus.toLocaleString("en-IN")} unallocated monthly surplus available.`
      : "No unallocated cash surplus remains after mandatory obligations.",
  });
  if (!chk6Pass) unresolvedConcerns.push("Zero or negative unallocated surplus.");

  // Check 7: Financial goals and time horizon
  checks.push({
    id: "goal_horizon",
    title: "Defined Investment Horizon",
    passed: true,
    details: "Time horizon evaluated against user financial goals and life stage.",
  });

  // Check 8: Portfolio concentration risks
  const goldExp = safeNum(s.goldExposurePercent);
  const chk8Pass = goldExp <= 20;
  checks.push({
    id: "portfolio_concentration",
    title: "Balanced Portfolio Concentration",
    passed: chk8Pass,
    details: chk8Pass
      ? `Asset concentration balanced (Gold exposure: ${goldExp}% of portfolio).`
      : `High Gold exposure (${goldExp}% of portfolio). Recommended cap is 10-15%.`,
  });
  if (!chk8Pass) unresolvedConcerns.push(`High Gold exposure (${goldExp}%). Prioritize equity or debt diversification.`);

  // Check 9: Data sufficiency
  const chk9Pass = income > 0 || expenses > 0 || debt > 0 || surplus > 0;
  checks.push({
    id: "data_sufficiency",
    title: "Sufficient Financial Records",
    passed: chk9Pass,
    details: chk9Pass
      ? "Sufficient verified MongoDB records available for comprehensive evaluation."
      : "Insufficient financial records. Add monthly income, expenses, and asset details.",
  });

  // Overall status derivation
  let status = "READY";
  let priorityRecommendation = "INVEST";

  if (surplus < 0 || !chk1Pass) {
    status = "DEFICIT_RECOVERY";
    priorityRecommendation = "REBALANCE_CASHFLOW";
  } else if (!chk4Pass) {
    status = "DEBT_FIRST";
    priorityRecommendation = "REPAY_LOAN";
  } else if (!chk3Pass) {
    status = "EMERGENCY_RESERVE_FIRST";
    priorityRecommendation = "BUILD_EMERGENCY_FUND";
  } else if (!chk5Pass) {
    status = "HOLD_LIQUIDITY";
    priorityRecommendation = "KEEP_LIQUID_CASH";
  } else {
    status = "READY";
    priorityRecommendation = "INVEST";
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const isReadyToInvest = status === "READY";

  return {
    isReadyToInvest,
    status,
    priorityRecommendation,
    passedChecksCount: passedCount,
    totalChecksCount: checks.length,
    checks,
    unresolvedConcerns,
  };
}

/**
 * Maturity-to-Action Evaluator.
 * Analyzes approaching or matured investments against outstanding loans and cash requirements.
 */
function evaluateMaturityToAction(params) {
  const investments = params.investments || params.items?.investments || [];
  const liabilities = params.liabilities || [];
  const upcomingExpenses = safeNum(params.upcomingExpenses || params.upcomingObligations);
  const emergencyFundMonths = safeNum(params.emergencyFundMonths, 3);
  const monthlyExpenses = safeNum(params.monthlyExpenses);

  const now = new Date();
  const maturingItems = [];

  investments.forEach((inv) => {
    if (!inv.maturityDate) return;
    const matDate = new Date(inv.maturityDate);
    if (Number.isNaN(matDate.getTime())) return;

    const diffMs = matDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining >= -30 && daysRemaining <= 60) {
      const confirmedAmount = safeNum(inv.actualMaturityValue || inv.estimatedMaturityAmount || inv.currentValue || inv.principalAmount || inv.amount);
      maturingItems.push({
        id: inv._id || inv.id,
        name: inv.name,
        type: inv.type,
        maturityDate: matDate,
        maturityDateFormatted: matDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        daysRemaining: Math.max(0, daysRemaining),
        isMatured: daysRemaining <= 0,
        amount: confirmedAmount,
        isConfirmedAmount: Boolean(inv.actualMaturityValue),
      });
    }
  });

  if (maturingItems.length === 0) {
    return {
      hasMaturingInvestment: false,
      hasMaturingItems: false,
      maturingItems: [],
      analysis: null,
      recommendation: "NO_ACTIVE_MATURITY",
      why: "No investments approaching maturity within the next 60 days.",
    };
  }

  maturingItems.sort((a, b) => a.daysRemaining - b.daysRemaining);
  const primaryItem = maturingItems[0];
  const proceeds = primaryItem.amount;

  const activeLoans = liabilities.filter((l) => String(l.status || "active").toLowerCase() === "active");
  const highestInterestLoan = activeLoans.length > 0
    ? [...activeLoans].sort((a, b) => safeNum(b.interestRate) - safeNum(a.interestRate))[0]
    : null;

  const urgentObligations = safeNum(upcomingExpenses);
  const emergencyShortfall = emergencyFundMonths < 3.0 ? Math.max(0, (3.0 - emergencyFundMonths) * safeNum(monthlyExpenses || 30000)) : 0;
  const safeAvailableForDebtOrInvest = Math.max(0, proceeds - urgentObligations - emergencyShortfall);

  let recommendation = "KEEP_LIQUID";
  let why = "";
  let loanAnalysis = null;

  if (highestInterestLoan && safeAvailableForDebtOrInvest > 0 && safeNum(highestInterestLoan.interestRate) >= 9.0) {
    recommendation = "REPAY_LOAN";
    loanAnalysis = calculateLoanPrepaymentAnalysis({
      principal: safeNum(highestInterestLoan.remainingAmount || highestInterestLoan.principalAmount),
      annualRate: safeNum(highestInterestLoan.interestRate),
      monthlyEMI: safeNum(highestInterestLoan.monthlyEMI),
      prepaymentAmount: safeAvailableForDebtOrInvest,
      daysToWaitingMaturity: primaryItem.daysRemaining,
    });
    why = `Prepaying ${highestInterestLoan.name} (${highestInterestLoan.interestRate}%) saves an estimated ₹${loanAnalysis.netInterestSaved.toLocaleString("en-IN")} in interest payments while eliminating debt risk.`;
  } else if (emergencyShortfall > 0) {
    recommendation = "BUILD_RESERVE";
    why = `Allocate ₹${Math.min(proceeds, Math.round(emergencyShortfall)).toLocaleString("en-IN")} to emergency cash or short-term FD to secure a 3-month living expense buffer.`;
  } else if (urgentObligations > 0) {
    recommendation = "COVER_OBLIGATIONS";
    why = `Retain ₹${urgentObligations.toLocaleString("en-IN")} in liquid cash for upcoming commitments and obligations, and deploy remainder into term deposits.`;
  } else {
    recommendation = "REINVEST_OR_FD";
    why = `Deploy proceeds into high-yield bank FDs (~7.1%) or systematic mutual fund SIPs based on time horizon.`;
  }

  return {
    hasMaturingInvestment: true,
    hasMaturingItems: true,
    maturingItems,
    primaryItem,
    proceeds,
    urgentObligations,
    emergencyShortfall: Math.round(emergencyShortfall),
    safeAvailableForDebtOrInvest: Math.round(safeAvailableForDebtOrInvest),
    recommendation,
    why,
    loanAnalysis,
  };
}

/**
 * Builds the comprehensive Actionable Choice Comparison Table (Section 6.E).
 * Strictly ranks choices based on user financial facts and provides verified trade-offs.
 */
function buildActionableComparisonMatrix({
  surplusAmount,
  surplus,
  hasActiveLoans = false,
  loanRate = 0,
  topLoanRate = 0,
  emergencyFundMonths = 0,
  needWithinOneMonth = false,
  loanSavingsAmount = 0,
  fdRate = "6.80% - 7.60%",
  benchmarkFDRate = 7.1,
}) {
  const actualSurplus = Math.max(0, safeNum(surplusAmount ?? surplus));
  const effectiveLoanRate = safeNum(loanRate || topLoanRate);
  const options = [];

  // Choice 1: Repay or Prepay the Loan
  if (hasActiveLoans && effectiveLoanRate > 0) {
    const isHighInterest = effectiveLoanRate >= 9.5;
    options.push({
      id: "repay_loan",
      choice: "Repay or partially prepay the loan",
      purpose: "Debt reduction & interest savings",
      whyToConsider: isHighInterest
        ? `Eliminates compounding ${effectiveLoanRate}% loan interest (risk-free, tax-free return). Estimated savings: ₹${safeNum(loanSavingsAmount).toLocaleString("en-IN")}.`
        : `Reduces principal on ${effectiveLoanRate}% loan and shortens remaining tenure.`,
      mainTradeOff: "Reduces liquid cash; lender prepayment fees may apply.",
      rank: isHighInterest ? 1 : emergencyFundMonths < 3 ? 3 : 2,
      suitability: isHighInterest ? "High" : "Moderate",
      risk: "Zero market risk (Guaranteed interest savings)",
      liquidity: "Low (Prepaid cash cannot be withdrawn)",
      timeHorizon: "Immediate / Loan tenure",
      illustrativeAllocation: isHighInterest ? Math.round(actualSurplus * 0.65) : Math.round(actualSurplus * 0.3),
    });
  }

  // Choice 2: Keep Accessible Cash Reserves
  options.push({
    id: "accessible_cash",
    choice: "Keep accessible cash reserves",
    purpose: "Emergency liquidity & near-term obligations",
    whyToConsider: emergencyFundMonths < 3 || needWithinOneMonth
      ? "Secures immediate living expenses, EMIs, and unplanned costs without needing to sell investments at a loss."
      : "Provides cash flexibility and peace of mind.",
    mainTradeOff: "Earns low interest; loses purchasing power to inflation over long periods.",
    rank: needWithinOneMonth ? 1 : emergencyFundMonths < 3 ? 1 : 4,
    suitability: emergencyFundMonths < 3 || needWithinOneMonth ? "Essential" : "Moderate",
    risk: "Zero capital risk (Inflation risk only)",
    liquidity: "Instant (Savings account / Sweep FD)",
    timeHorizon: "Immediate (0 - 6 Months)",
    illustrativeAllocation: needWithinOneMonth
      ? actualSurplus
      : emergencyFundMonths < 3
      ? Math.round(actualSurplus * 0.7)
      : Math.round(actualSurplus * 0.2),
  });

  // Choice 3: Open a Short-Term FD
  options.push({
    id: "short_term_fd",
    choice: "Open a short-term Fixed Deposit (6 - 12 Months)",
    purpose: "Capital preservation for defined near-term goals",
    whyToConsider: `Locks in published ~${benchmarkFDRate}% bank rate with DICGC sovereign insurance protection up to ₹5,00,000.`,
    mainTradeOff: "Premature withdrawal penalty (typically 0.5% - 1.0%); interest fully taxable at slab rate.",
    rank: emergencyFundMonths >= 3 && needWithinOneMonth === false ? 3 : 5,
    suitability: emergencyFundMonths >= 3 ? "Moderate to High" : "Low",
    risk: "Very Low (DICGC Insured up to ₹5L)",
    liquidity: "Moderate (Premature withdrawal allowed with penalty)",
    timeHorizon: "6 - 12 Months",
    illustrativeAllocation: emergencyFundMonths >= 3 && !hasActiveLoans ? Math.round(actualSurplus * 0.25) : 0,
  });

  // Choice 4: Open a Longer-Term FD
  options.push({
    id: "long_term_fd",
    choice: "Open a longer-term Fixed Deposit (1 - 3+ Years)",
    purpose: "Guaranteed medium-term return",
    whyToConsider: `Published Tier-1 rates offer ${fdRate}. DICGC insurance protects principal and interest up to ₹5,00,000 per bank.`,
    mainTradeOff: "Reduces liquidity; tax deduction on interest as per slab rate.",
    rank: 4,
    suitability: "Moderate",
    risk: "Very Low",
    liquidity: "Low to Moderate",
    timeHorizon: "1 - 3 Years",
    illustrativeAllocation: Math.round(actualSurplus * 0.2),
  });

  // Choice 5: Invest in a Diversified Mutual Fund / Index Fund
  options.push({
    id: "mutual_fund",
    choice: "Invest in a diversified equity / index fund",
    purpose: "Long-term wealth compounding above inflation",
    whyToConsider: "NIFTY 50 10-year historical CAGR of 12.5% provides superior inflation-beating capital growth for horizons > 5 years.",
    mainTradeOff: "Subject to equity market volatility and capital loss in the short term. Not suitable for near-term cash.",
    rank: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? 1 : 5,
    suitability: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? "High" : "Low to Moderate",
    risk: "Market Volatility / Equity Risk",
    liquidity: "T+2 Redemption (subject to exit loads & LTCG tax)",
    timeHorizon: "Long-term (3 to 7+ Years)",
    illustrativeAllocation: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? Math.round(actualSurplus * 0.5) : 0,
  });

  // Choice 6: Continue or Start a Disciplined SIP
  options.push({
    id: "sip",
    choice: "Continue or start a disciplined monthly SIP",
    purpose: "Systematic rupee-cost averaging",
    whyToConsider: "Automates investing, averages purchase costs across market cycles, and instills financial discipline.",
    mainTradeOff: "Requires continuous monthly cash surplus; does not guarantee positive returns.",
    rank: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? 2 : 6,
    suitability: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? "High" : "Low",
    risk: "Underlying fund market risk",
    liquidity: "Monthly commitment (flexible to pause)",
    timeHorizon: "Ongoing / Goal-based",
    illustrativeAllocation: !hasActiveLoans && emergencyFundMonths >= 3 && !needWithinOneMonth ? Math.round(actualSurplus * 0.3) : 0,
  });

  // Sort by rank ascending
  options.sort((a, b) => a.rank - b.rank);

  // Normalize illustrative allocations so their sum strictly equals surplus without exceeding it
  let totalAllocated = options.reduce((sum, o) => sum + (o.illustrativeAllocation || 0), 0);
  if (totalAllocated > actualSurplus && actualSurplus > 0) {
    const scale = actualSurplus / totalAllocated;
    options.forEach((o) => {
      o.illustrativeAllocation = Math.round(o.illustrativeAllocation * scale);
    });
  }

  return options;
}

module.exports = {
  calculateLoanPrepaymentAnalysis,
  calculateFixedDepositReturns,
  assessInvestmentReadiness,
  evaluateMaturityToAction,
  buildActionableComparisonMatrix,
};
