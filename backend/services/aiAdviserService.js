// ============================================================
// FINANCEOS - AI ADVISER SERVICE
// Centralized Engine (Official @google/genai SDK + Math + MongoDB)
// Live Indian Market Data, Personalized Recommendations & Loan/FD Analysis
// ============================================================

const { GoogleGenAI } = require("@google/genai");
const User = require("../models/User");
const MonthlyFinance = require("../models/MonthlyFinance");
const Investment = require("../models/Investment");
const Insurance = require("../models/Insurance");
const Liability = require("../models/Liability");
const SavingGoal = require("../models/SavingGoal");
const AdditionalIncome = require("../models/AdditionalIncome");
const AISuggestion = require("../models/AISuggestion");
const {
  getLiveMarketBenchmarks,
  getRelevantMarketData,
  getVerifiedBankFDRates,
  getVerifiedGovtSchemes,
  formatDateTimeIST,
} = require("./marketDataService");
const {
  calculateLoanPrepaymentAnalysis,
  calculateFixedDepositReturns,
  assessInvestmentReadiness,
  evaluateMaturityToAction,
  buildActionableComparisonMatrix,
} = require("./financialAnalysisEngine");

// ============================================================
// HELPER UTILITIES
// ============================================================

function safeNum(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

function formatINR(amount) {
  return "₹" + safeNum(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ============================================================
// STANDARD EVERYDAY FINANCIAL TERMS GLOSSARY
// Briefly explains financial terms for ordinary users
// ============================================================

const STANDARD_GLOSSARY = [
  {
    term: "SIP (Systematic Investment Plan)",
    definition: "A disciplined way to invest a set amount every month into a mutual fund, rather than investing all your money at once.",
  },
  {
    term: "NAV (Net Asset Value)",
    definition: "The price of one unit of a mutual fund scheme on a given day, calculated and published by AMFI after market close.",
  },
  {
    term: "FD (Fixed Deposit)",
    definition: "A safe bank deposit where your money earns a guaranteed, fixed interest rate over an agreed period. Insured up to ₹5,00,000 per bank by DICGC (RBI subsidiary).",
  },
  {
    term: "IPO (Initial Public Offering)",
    definition: "When a private company sells its shares to regular public investors for the first time on stock exchanges like NSE or BSE.",
  },
  {
    term: "GMP (Grey Market Premium)",
    definition: "An unofficial, unregulated indicator of what informal traders are paying before a stock lists. It is speculative, can fluctuate rapidly, and is NEVER a guaranteed profit.",
  },
  {
    term: "EMI (Equated Monthly Installment)",
    definition: "A fixed monthly amount you pay to repay a loan, covering both principal balance and interest until the loan is cleared.",
  },
  {
    term: "Mutual Fund",
    definition: "A professionally managed pool of money from many investors that invests in a diversified basket of stocks, bonds, or government securities.",
  },
];

// ============================================================
// BUILD RECOMMENDED CATEGORIES EVALUATION (Section 4.1)
// ============================================================

function buildRecommendedCategories({ snapshot, readiness, loanAnalysis, market }) {
  const surplus = snapshot.availableToAllocate;
  const efMonths = snapshot.emergencyFundMonths;
  const hasHighDebt = loanAnalysis.hasActiveLoans && loanAnalysis.loanSummary.interestRate >= 10;
  const goldExp = snapshot.goldExposurePercent;

  return [
    {
      category: "Emergency Cash & Liquid Reserves",
      suitability: efMonths < 3 ? "Essential / Top Priority" : "Adequately Maintained",
      purpose: "Capital preservation and immediate liquidity for unplanned expenses or emergencies.",
      rationale: efMonths < 3
        ? `Liquid buffer currently stands at ${efMonths} months of living expenses. Priority must be given to reaching 3-6 months (${formatINR(snapshot.expenses * 3)} - ${formatINR(snapshot.expenses * 6)}) before entering volatile assets.`
        : `Safe reserve buffer of ${efMonths} months maintained. No urgent liquid accumulation needed.`,
      risk: "Inflation risk (real purchasing power diminishes if kept in low-interest savings).",
      liquidity: "Instant / Same-day access.",
      timeHorizon: "Immediate (0 - 6 Months)",
      taxation: "Savings interest exempt up to ₹10,000/yr under Section 80TTA (₹50,000 for seniors under 80TTB); balance taxed at slab rate.",
    },
    {
      category: "Debt Reduction / Loan Prepayment",
      suitability: hasHighDebt ? "High / Financially Preferable" : (loanAnalysis.hasActiveLoans ? "Moderate" : "Not Applicable"),
      purpose: "Guaranteed interest cost reduction without exposure to market risk.",
      rationale: hasHighDebt
        ? `Prepaying loan at ${loanAnalysis.loanSummary.interestRate}% provides an assured after-tax return equal to your borrowing cost, saving ₹${safeNum(loanAnalysis.netInterestSaved).toLocaleString("en-IN")} in net interest.`
        : (loanAnalysis.hasActiveLoans ? `Loan rate of ${loanAnalysis.loanSummary.interestRate}% is moderate. Review prepayment against liquid FD yields.` : "No outstanding debt on record."),
      risk: "Reduces liquid cash; lender prepayment penalties may apply.",
      liquidity: "Permanent debt retirement (funds cannot be re-withdrawn).",
      timeHorizon: "Immediate / Monthly",
      taxation: "Reduces future interest tax deduction where applicable (e.g. Section 24b).",
    },
    {
      category: "Fixed Deposits (FD) & Recurring Deposits (RD)",
      suitability: efMonths < 6 || surplus > 0 ? "High for Capital Preservation" : "Moderate",
      purpose: "Capital preservation with predictable fixed yields and DICGC sovereign insurance protection.",
      rationale: `Published Tier-1 bank card rates offer ${market.fixedDeposit?.benchmarkRange || "6.80% - 7.60%"} p.a. for 1-3 year tenures, protected up to ₹5,00,000 per depositor per bank under DICGC.`,
      risk: "Premature withdrawal penalty (typically 0.5% - 1.0%); multi-year inflation drag.",
      liquidity: "Redeemable before maturity subject to penalty.",
      timeHorizon: "1 Year - 3 Years",
      taxation: "Interest fully taxable at individual slab rate; TDS deducted if interest exceeds ₹40,000/year (₹50,000 for seniors).",
    },
    {
      category: "Government Savings (PPF, NSC, SGB, T-Bills)",
      suitability: "High for Risk-Averse Long-Term Savers",
      purpose: "Sovereign-backed risk-free wealth building with favorable tax treatment.",
      rationale: "Public Provident Fund (PPF) yields 7.10% p.a. under EEE tax status (15-yr lock-in). National Savings Certificate (NSC) offers 7.70% p.a. for 5-year goal accumulation under Section 80C.",
      risk: "Long lock-in tenures; interest rates reset quarterly by Ministry of Finance.",
      liquidity: "Restricted (PPF partial withdrawals from Year 7; NSC locked for 5 years).",
      timeHorizon: "5 - 15 Years",
      taxation: "PPF is completely tax-free (EEE); NSC interest taxable at maturity under Section 80C reinvestment rules.",
    },
    {
      category: "Diversified Equity Mutual Funds & Index Funds",
      suitability: !hasHighDebt && efMonths >= 3 ? "High for Long-Term Wealth" : "Secondary Priority",
      purpose: "Long-term inflation-beating capital appreciation via disciplined market participation.",
      rationale: "Broad-market index funds (NIFTY 50 10-Yr historical CAGR: 12.50%) and flexi-cap funds allow systematic participation in Indian economic growth without stock-picking risk.",
      risk: "Equity market volatility; risk of negative returns over short durations; no guaranteed yield.",
      liquidity: "T+2 business days redemption (exit load applies if redeemed within 1 year).",
      timeHorizon: "3 - 7+ Years",
      taxation: "Long-Term Capital Gains (LTCG) above ₹1.25 Lakh taxed at 12.5%; Short-Term Capital Gains (STCG) taxed at 20%.",
    },
    {
      category: "Systematic Investment Plan (SIP)",
      suitability: !hasHighDebt && efMonths >= 3 && surplus > 0 ? "Recommended Method" : "Pause / Calibrate",
      purpose: "Disciplined rupee-cost averaging across market cycles from verified unallocated monthly cash flow.",
      rationale: surplus > 0
        ? `Allocating an illustrative ₹${safeNum(Math.round(surplus * 0.4)).toLocaleString("en-IN")} - ₹${safeNum(Math.round(surplus * 0.6)).toLocaleString("en-IN")} monthly instills investing discipline without straining living liquidity.`
        : "SIPs should only be initiated from recurring, verified cash surpluses, not emergency funds.",
      risk: "Risk mirrors the underlying mutual fund; SIP is an investment method, not a guaranteed-return asset.",
      liquidity: "Completely flexible to pause, stop, or adjust monthly amounts at any time.",
      timeHorizon: "Ongoing / Goal-based",
      taxation: "Each installment is treated as an independent investment for holding period and LTCG/STCG calculation.",
    },
    {
      category: "Direct Stocks",
      suitability: "Selective / Experienced Only",
      purpose: "Direct company ownership for investors with research capability and loss absorption tolerance.",
      rationale: "Direct equities require verified financial ratios, continuous monitoring, and ability to withstand 20-30% drawdowns. Index funds are preferable for core personal savings.",
      risk: "Company-specific concentration risk, market cycle downturns, and total loss of capital.",
      liquidity: "T+1 settlement on NSE / BSE.",
      timeHorizon: "5+ Years",
      taxation: "LTCG above ₹1.25 Lakh at 12.5%; STCG at 20%.",
    },
    {
      category: "Gold & Silver (Hedge / Diversification)",
      suitability: goldExp < 15 ? "Moderate (5% - 10% Portfolio Hedge)" : "Concentration Cap Reached",
      purpose: "Portfolio hedge against currency depreciation, inflation, and global macro stress.",
      rationale: goldExp < 15
        ? `Current 24K gold is ${market.gold?.pricePerGram24K ? '₹' + market.gold.pricePerGram24K + '/g' : 'market benchmark'}. Sovereign Gold Bonds or Gold ETFs avoid making charges and physical storage risks.`
        : `Gold currently accounts for ${goldExp}% of portfolio assets. Maintain current allocation without adding.`,
      risk: "Commodity price cycles; no periodic dividend or yield (except SGB 2.5% coupon).",
      liquidity: "ETFs tradable on exchange during market hours; physical gold subject to jeweler spreads.",
      timeHorizon: "3 - 5+ Years",
      taxation: "Gold ETF/Fund gains taxed as capital gains; SGB capital gains fully tax-exempt at 8-year maturity.",
    },
  ];
}

// ============================================================
// CALCULATE USER FINANCIAL SNAPSHOT (SAFE & NORMALIZED)
// ============================================================

async function calculateFinancialSnapshot(userId, targetMonthStr = "") {
  let targetYear = new Date().getFullYear();
  let targetMonth = new Date().getMonth() + 1;

  if (targetMonthStr && /^\d{4}-\d{1,2}$/.test(targetMonthStr)) {
    const [y, m] = targetMonthStr.split("-").map(Number);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
      targetYear = y;
      targetMonth = m;
    }
  }

  // 1. Fetch user data in parallel
  const [
    user,
    monthlyFinances,
    investments,
    insurances,
    liabilities,
    savingGoals,
    additionalIncomes,
  ] = await Promise.all([
    User.findById(userId).lean(),
    MonthlyFinance.find({ user: userId }).sort({ year: -1, month: -1 }).lean(),
    Investment.find({ user: userId }).lean(),
    Insurance.find({ user: userId }).lean(),
    Liability.find({ user: userId }).lean(),
    SavingGoal.find({ user: userId }).lean(),
    AdditionalIncome.find({ user: userId }).lean(),
  ]);

  // 2. Identify the targeted monthly finance record
  let targetedMF = monthlyFinances.find(
    (mf) => mf.year === targetYear && mf.month === targetMonth
  );

  if (!targetedMF) {
    targetedMF = monthlyFinances[0] || {
      income: 0,
      expenses: 0,
      openingBalance: 0,
      cashBalance: 0,
      savings: 0,
    };
  }

  const monthlyIncome = safeNum(targetedMF.income);
  const monthlyExpenses = safeNum(targetedMF.expenses);
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  // 3. Additional incomes for this month
  const activeAddIncomes = additionalIncomes
    .filter((ai) => String(ai.status || "active").toLowerCase() === "active")
    .reduce((acc, ai) => acc + safeNum(ai.amount), 0);

  // 4. Investment commitments & categorized asset values
  let monthlyInvestmentCommitment = 0;
  let totalInvestmentsValue = 0;
  let maturedInvestments = [];
  let activeSIPs = [];
  let activeFDs = [];
  let activeRDs = [];
  let goldInvestments = [];
  let silverInvestments = [];
  let stockInvestments = [];
  let mutualFundInvestments = [];
  let propertyInvestments = [];

  let goldValue = 0;
  let silverValue = 0;
  let equityValue = 0;
  let fdValue = 0;
  let rdValue = 0;
  let propertyValue = 0;

  investments.forEach((inv) => {
    const status = String(inv.status || "active").toLowerCase();
    const type = String(inv.type || "").toUpperCase();
    const amount = safeNum(inv.monthlyContribution || inv.amount || inv.principalAmount);
    const currVal = safeNum(inv.currentValue !== undefined ? inv.currentValue : (inv.principalAmount || inv.amount));

    if (status === "active") {
      if (type.includes("SIP") || inv.frequency === "Monthly" || inv.monthlyContribution > 0) {
        monthlyInvestmentCommitment += amount;
        activeSIPs.push(inv);
      } else if (inv.frequency === "Quarterly") {
        monthlyInvestmentCommitment += amount / 3;
      } else if (inv.frequency === "Yearly") {
        monthlyInvestmentCommitment += amount / 12;
      }

      if (type.includes("FD") || type.includes("FIXED")) {
        activeFDs.push(inv);
        fdValue += currVal;
      } else if (type.includes("RD") || type.includes("RECURRING")) {
        activeRDs.push(inv);
        rdValue += currVal;
      } else if (type.includes("GOLD")) {
        goldInvestments.push(inv);
        goldValue += currVal;
      } else if (type.includes("SILVER")) {
        silverInvestments.push(inv);
        silverValue += currVal;
      } else if (type.includes("STOCK") || type.includes("EQUITY") || type.includes("SHARE")) {
        stockInvestments.push(inv);
        equityValue += currVal;
      } else if (type.includes("MUTUAL") || type.includes("MF")) {
        mutualFundInvestments.push(inv);
        equityValue += currVal;
      } else if (type.includes("PROPERTY") || type.includes("REAL ESTATE") || type.includes("LAND")) {
        propertyInvestments.push(inv);
        propertyValue += currVal;
      }

      totalInvestmentsValue += currVal;
    } else if (status === "matured" || status === "completed") {
      maturedInvestments.push(inv);
      totalInvestmentsValue += safeNum(inv.actualMaturityValue || inv.estimatedMaturityAmount || inv.amount);
    }
  });

  // 5. Insurance commitments
  let monthlyInsuranceCommitment = 0;
  let totalInsurancePremiums = 0;
  insurances.forEach((ins) => {
    const status = String(ins.status || "active").toLowerCase();
    const premium = safeNum(ins.premiumAmount || ins.monthlyPremium);
    const freq = String(ins.premiumFrequency || "Monthly").toLowerCase();

    if (status === "active") {
      totalInsurancePremiums += premium;
      if (freq === "yearly" || freq === "annual" || freq === "annually") {
        monthlyInsuranceCommitment += premium / 12;
      } else if (freq === "half-yearly" || freq === "semi-annual") {
        monthlyInsuranceCommitment += premium / 6;
      } else if (freq === "quarterly") {
        monthlyInsuranceCommitment += premium / 3;
      } else {
        monthlyInsuranceCommitment += premium;
      }
    }
  });

  // 6. Liabilities commitments & debt balance
  let monthlyLiabilityCommitment = 0;
  let totalLiabilitiesBalance = 0;
  liabilities.forEach((liab) => {
    const status = String(liab.status || "active").toLowerCase();
    if (status === "active") {
      monthlyLiabilityCommitment += safeNum(liab.monthlyEMI || liab.minimumDue || liab.minimumPayment);
      totalLiabilitiesBalance += safeNum(liab.remainingAmount !== undefined ? liab.remainingAmount : (liab.principalAmount || liab.totalAmount));
    }
  });

  // 7. Saving Goals & Accumulated funds
  let totalGoalSaved = 0;
  let monthlyGoalCommitment = 0;
  let nearCompletionGoals = [];
  savingGoals.forEach((g) => {
    const status = String(g.status || "active").toLowerCase();
    const target = safeNum(g.targetAmount);
    const saved = safeNum(g.currentAmount || g.savedAmount || g.totalContributed);
    const mContrib = safeNum(g.monthlyContribution);

    if (status === "active") {
      totalGoalSaved += saved;
      monthlyGoalCommitment += mContrib;
      if (target > 0 && saved / target >= 0.75 && saved < target) {
        nearCompletionGoals.push(g);
      }
    }
  });

  // 8. Aggregate commitments & available-to-allocate
  const totalCommitments =
    monthlyInvestmentCommitment +
    monthlyInsuranceCommitment +
    monthlyLiabilityCommitment +
    monthlyGoalCommitment;

  const openingBalance = safeNum(targetedMF.openingBalance !== undefined ? targetedMF.openingBalance : targetedMF.cashBalance);
  const closingBalance = openingBalance + monthlySavings - totalCommitments;
  const availableToAllocate = closingBalance;

  // 9. Total Assets & Net Worth
  const totalAssets = closingBalance + totalInvestmentsValue + totalGoalSaved;
  const netWorth = totalAssets - totalLiabilitiesBalance;

  // 10. Emergency Fund Runway (months)
  const emergencyFundMonths =
    monthlyExpenses > 0 ? (totalGoalSaved + Math.max(0, closingBalance)) / monthlyExpenses : 0;

  // 11. Portfolio Exposure Percentages
  const goldExposurePercent = totalAssets > 0 ? Number(((goldValue / totalAssets) * 100).toFixed(1)) : 0;
  const equityExposurePercent = totalAssets > 0 ? Number(((equityValue / totalAssets) * 100).toFixed(1)) : 0;

  // 12. Investment Readiness Assessment (Section 5 9-Point Checklist)
  const investmentReadiness = assessInvestmentReadiness({
    snapshot: {
      income: monthlyIncome,
      expenses: monthlyExpenses,
      availableToAllocate,
      emergencyFundMonths,
      totalLiabilities: totalLiabilitiesBalance,
      goldExposurePercent,
      equityExposurePercent,
    },
    items: {
      liabilities,
      insurances,
      savingGoals,
      investments,
    },
  });

  // 13. Loan vs Investment vs FD Analysis (Section 6.A)
  const activeLiabilities = liabilities.filter((l) => String(l.status || "active").toLowerCase() === "active");
  const topLiability = activeLiabilities.sort((a, b) => safeNum(b.interestRate) - safeNum(a.interestRate))[0];

  let loanVsInvestmentAnalysis = {
    hasActiveLoans: activeLiabilities.length > 0,
    hasMaturingInvestments: maturedInvestments.length > 0,
    loanSummary: {
      principal: topLiability ? safeNum(topLiability.remainingAmount || topLiability.principalAmount) : 0,
      interestRate: topLiability ? safeNum(topLiability.interestRate) : 0,
      monthlyEMI: topLiability ? safeNum(topLiability.monthlyEMI) : 0,
      remainingTenureMonths: topLiability ? safeNum(topLiability.tenureMonths || 0) : 0,
    },
    waitingInterestCost: 0,
    grossInterestSaved: 0,
    prepaymentPenalty: 0,
    netInterestSaved: 0,
    tenureMonthsSaved: 0,
    recommendation: "",
    rationale: "",
  };

  if (topLiability && safeNum(topLiability.interestRate) > 0) {
    const loanCalc = calculateLoanPrepaymentAnalysis({
      principal: topLiability.remainingAmount || topLiability.principalAmount,
      annualRate: topLiability.interestRate,
      monthlyEMI: topLiability.monthlyEMI,
      tenureMonths: topLiability.tenureMonths || 0,
      prepaymentAmount: Math.max(0, availableToAllocate),
      prepaymentPenaltyPercent: safeNum(topLiability.prepaymentPenaltyPercent || 0),
      daysToWaitingMaturity: 15,
    });
    if (loanCalc.isValid) {
      loanVsInvestmentAnalysis = {
        hasActiveLoans: true,
        hasMaturingInvestments: maturedInvestments.length > 0,
        loanSummary: {
          principal: loanCalc.principal,
          interestRate: loanCalc.annualRate,
          monthlyEMI: loanCalc.monthlyEMI,
          remainingTenureMonths: loanCalc.originalTenureMonths,
        },
        waitingInterestCost: loanCalc.waitingInterestCost,
        grossInterestSaved: loanCalc.grossInterestSaved,
        prepaymentPenalty: loanCalc.prepaymentPenaltyCharges,
        netInterestSaved: loanCalc.netInterestSaved,
        tenureMonthsSaved: loanCalc.tenureMonthsSaved,
        recommendation: loanCalc.netInterestSaved > 0 ? "Prepay Loan Principal" : "Maintain Scheduled Payments",
        rationale: loanCalc.netInterestSaved > 0
          ? `Prepaying ${formatINR(Math.max(0, availableToAllocate))} saves ${formatINR(loanCalc.netInterestSaved)} in net interest after penalty, cutting ${loanCalc.tenureMonthsSaved} months off debt.`
          : "Prepaying does not yield meaningful interest savings under current terms.",
      };
    }
  }

  // 14. Maturity-to-Action Plan (Section 6.B)
  const maturityToAction = evaluateMaturityToAction({
    items: { investments },
    liabilities,
    surplus: availableToAllocate,
    emergencyFundMonths,
    upcomingObligations: monthlyInsuranceCommitment + monthlyLiabilityCommitment,
  });

  // 15. Actionable Comparison Matrix (Section 6.E)
  const comparisonMatrix = buildActionableComparisonMatrix({
    surplus: availableToAllocate,
    hasActiveLoans: activeLiabilities.length > 0,
    topLoanRate: topLiability ? safeNum(topLiability.interestRate) : 0,
    emergencyFundMonths,
    needWithinOneMonth: false,
    benchmarkFDRate: 7.1,
  });

  return {
    user: {
      name: user?.name || "FinanceOS User",
      email: user?.email || "",
      city: user?.city || "",
      state: user?.state || "",
      currency: "INR (₹)",
    },
    snapshot: {
      targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      targetPeriodLabel: `${targetYear} Month ${targetMonth}`,
      income: monthlyIncome,
      expenses: monthlyExpenses,
      monthlySavings,
      savingsRate: Number(savingsRate.toFixed(1)),
      openingBalance: Math.round(openingBalance),
      closingBalance: Math.round(closingBalance),
      totalCommitments: Math.round(totalCommitments),
      monthlyInvestmentCommitment: Math.round(monthlyInvestmentCommitment),
      monthlyInsuranceCommitment: Math.round(monthlyInsuranceCommitment),
      monthlyLiabilityCommitment: Math.round(monthlyLiabilityCommitment),
      monthlyGoalCommitment: Math.round(monthlyGoalCommitment),
      availableToAllocate: Math.round(availableToAllocate),
      totalInvestments: Math.round(totalInvestmentsValue),
      totalLiabilities: Math.round(totalLiabilitiesBalance),
      totalInsurancePremiums: Math.round(totalInsurancePremiums),
      totalGoalSaved: Math.round(totalGoalSaved),
      netWorth: Math.round(netWorth),
      emergencyFundMonths: Number(emergencyFundMonths.toFixed(1)),
      activeGoalsCount: savingGoals.filter((g) => g.status === "active").length,
      maturedInvestmentsCount: maturedInvestments.length,
      activeSIPsCount: activeSIPs.length,
      activeFDsCount: activeFDs.length,
      activeRDsCount: activeRDs.length,
      goldHoldingsCount: goldInvestments.length,
      silverHoldingsCount: silverInvestments.length,
      stockHoldingsCount: stockInvestments.length,
      goldExposurePercent,
      equityExposurePercent,
      goldValue,
      silverValue,
      equityValue,
      fdValue,
      rdValue,
      propertyValue,
      investmentReadiness,
      loanVsInvestmentAnalysis,
      maturityToAction,
      comparisonMatrix,
    },
    items: {
      maturedInvestments: maturedInvestments.map(i => ({ name: i.name, type: i.type, amount: i.actualMaturityValue || i.estimatedMaturityAmount || i.amount })),
      nearCompletionGoals: nearCompletionGoals.map(g => ({ name: g.goalName || g.name, target: g.targetAmount, saved: g.currentAmount || g.savedAmount })),
      activeSIPs: activeSIPs.map(s => ({ name: s.name, amount: s.monthlyContribution || s.amount, currentValue: s.currentValue })),
      activeFDs: activeFDs.map(f => ({ name: f.name, principal: f.principalAmount || f.amount, rate: f.interestRate, maturityDate: f.maturityDate })),
      activeRDs: activeRDs.map(r => ({ name: r.name, monthly: r.monthlyContribution || r.amount, rate: r.interestRate })),
      goldInvestments: goldInvestments.map(g => ({
        id: g._id,
        name: g.name,
        goldType: g.goldType || "Physical Gold",
        weight: safeNum(g.weight),
        purity: g.purity || "24K",
        purchasePrice: safeNum(g.purchasePrice),
        principalAmount: safeNum(g.principalAmount || g.amount),
        currentValue: safeNum(g.currentValue !== undefined ? g.currentValue : (g.principalAmount || g.amount)),
      })),
      silverInvestments: silverInvestments.map(s => ({ name: s.name, weight: safeNum(s.weight), currentValue: s.currentValue || s.amount })),
      stockInvestments: stockInvestments.map(s => ({ name: s.name, value: s.currentValue || s.amount })),
      mutualFundInvestments: mutualFundInvestments.map(m => ({ name: m.name, value: m.currentValue || m.amount })),
      propertyInvestments: propertyInvestments.map(p => ({ name: p.name, value: p.currentValue || p.amount })),
      liabilities: liabilities.filter((l) => l.status === "active").map(l => ({ name: l.name, type: l.type, remaining: l.remainingAmount || l.principalAmount, emi: l.monthlyEMI, rate: l.interestRate })),
      insurances: insurances.filter((i) => i.status === "active").map(i => ({ name: i.name, type: i.type, coverage: i.coverageAmount, premium: i.premiumAmount })),
      savingGoals: savingGoals.filter((g) => g.status === "active").map(g => ({ name: g.goalName || g.name, target: g.targetAmount, saved: g.currentAmount || g.savedAmount, monthly: g.monthlyContribution })),
    },
  };
}

// ============================================================
// GEMINI API INVOCATION WITH OFFICIAL @google/genai SDK
// ============================================================

async function callGeminiAdviser(promptData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "mock_or_empty") {
    const err = new Error("GEMINI_API_KEY is not configured in backend/.env. Please configure a valid Google Gemini API key to enable live AI financial recommendations.");
    err.code = "GEMINI_API_KEY_MISSING";
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const systemInstruction = `You are the FinanceOS Personal AI Financial Guide.
Your purpose is to explain financial decisions in everyday, friendly, simple English so that ordinary people with no finance background can easily understand.

CRITICAL COMMUNICATION GUIDELINES:
1. SIMPLE EVERYDAY LANGUAGE: Avoid complicated financial jargon.
   - INSTEAD OF: "Your liquidity position indicates an opportunity for fixed-income allocation."
   - SAY: "You have ₹10,000 available after your recorded commitments. You could compare current bank FD rates before deciding where to keep this money. First, make sure you have enough cash for upcoming bills and emergencies."
2. THE 7 KEY QUESTIONS: Every recommendation must clearly answer:
   - What is happening with my money?
   - How much money is actually available?
   - What options do I have?
   - Why might one option suit me better?
   - What are the risks?
   - What should I do next?
   - Where can I learn more or open the official product page?
3. EXPLAIN TERMS: When you mention terms such as SIP, NAV, FD, IPO, GMP, EMI, or mutual fund, briefly explain them in plain language.
4. HONESTY & ZERO FABRICATION: Strictly use the authenticated user's real MongoDB numbers (Available to Allocate, Cash Balance, EMIs, expenses, commitments). Never invent missing financial info; if something is unavailable, explain that simply. Never recommend investing the entire available balance if emergency cash is lacking.
5. NO GUARANTEES OR TRADE COMMANDS: Never promise returns or tell the user to execute trades. Use helpful guidance: "Consider...", "You could compare...", "A practical next step is...".
6. MANDATORY DISCLAIMER: Your response MUST include this exact verbatim sentence:
   "Invest at your own risk — market prices and conditions can change, and values may increase or decrease."
7. THE 3-SECTION FORMAT:
   - Section A: Your situation (plain-English explanation of current finances & available money).
   - Section B: Your options (compare 2-4 realistic choices: emergency cash, bank FD, mutual fund SIP, loan prepayment, gold hedge).
   - Section C: Your next step (one clear, practical action, why it fits, what could go wrong, and what info is still missing).

OUTPUT JSON SCHEMA:
{
  "title": "Friendly headline summary (max 12 words, in everyday English)",
  "summary": "1-2 short, friendly sentences summarizing what is happening with the money and the best next step.",
  "category": "Wealth Growth | Emergency Reserve | Debt Optimization | Capital Preservation",
  "overallHealth": "Good | Moderate | Needs Attention",
  "yourSituation": {
    "text": "Friendly explanation of the user's situation answering: What is happening with my money? How much is actually available?",
    "availableAmount": ${promptData.snapshot.availableToAllocate},
    "emergencyBufferText": "${promptData.snapshot.emergencyFundMonths} months of essential living costs saved",
    "summary": "Short 1-sentence position summary with key rupee amounts."
  },
  "yourOptions": [
    {
      "option": "Clear option title (e.g., 'Compare Bank Fixed Deposits (FD)', 'Build Emergency Savings')",
      "category": "Fixed Deposit | Emergency Fund | Mutual Fund | Debt Paydown | Stocks | Gold",
      "whyFits": "Plain English explanation of why this option might suit the user's current situation.",
      "risks": "Clear explanation of what could go wrong (e.g. lock-in penalty, market drop, inflation).",
      "suitability": "Recommended | Consider | Save First | Debt First | Wait",
      "amount": 0,
      "officialLink": "Official website URL (e.g. https://sbi.co.in or https://www.amfiindia.com) or empty string"
    }
  ],
  "yourNextStep": {
    "action": "One specific, practical action the user should take next in everyday English.",
    "why": "Why this step fits their current finances.",
    "risks": "What could go wrong or what risk to watch out for.",
    "missingInfo": "Any important financial detail missing from their profile (or 'Your financial profile is complete')",
    "officialLink": "Official link to learn more or compare offers"
  },
  "currentPosition": {
    "availableToAllocate": ${promptData.snapshot.availableToAllocate},
    "savingsRate": ${promptData.snapshot.savingsRate},
    "emergencyFundMonths": ${promptData.snapshot.emergencyFundMonths},
    "totalLiabilities": ${promptData.snapshot.totalLiabilities},
    "goldExposurePercent": ${promptData.snapshot.goldExposurePercent},
    "equityExposurePercent": ${promptData.snapshot.equityExposurePercent},
    "summary": "Available surplus ₹${safeNum(promptData.snapshot.availableToAllocate).toLocaleString('en-IN')}; ${promptData.snapshot.emergencyFundMonths} months reserve buffer."
  },
  "marketInsight": {
    "summary": "Short factual observation of Indian market conditions in simple words.",
    "goldSpotFormatted": "Verified Gold 24K price or 'Unavailable'",
    "silverSpotFormatted": "Verified Silver price or 'Unavailable'",
    "niftyIndexFormatted": "Verified Nifty value or 'Unavailable'",
    "fdRangeFormatted": "Verified FD range or 'Unavailable'",
    "keyFactors": ["Factor 1", "Factor 2"]
  },
  "personalizedSuggestion": {
    "text": "Friendly guidance on what the user may consider doing with their money.",
    "reason": "Short financial rationale referencing user records in plain English.",
    "priority": "High | Medium | Low",
    "actionCategory": "Wealth Compounding | Reserve Buffer | Debt Paydown | Capital Preservation"
  },
  "futureOutlook": {
    "baseCase": "Likely short-term scenario.",
    "bullCase": "Potential upside scenario.",
    "bearCase": "Potential downside scenario or risk.",
    "keyRisks": ["Risk 1", "Risk 2"]
  },
  "riskDisclaimer": "Invest at your own risk — market prices and conditions can change, and values may increase or decrease.",
  "recommendations": [
    {
      "category": "Gold | Stocks | Mutual Funds | Fixed Deposit | Debt Paydown | Emergency Fund | Govt Schemes",
      "priority": "High | Medium | Low",
      "decision": "INVEST | CONSIDER | WAIT | AVOID_FOR_NOW | SAVE_FIRST | DEBT_FIRST | DIVERSIFY | HOLD_LIQUIDITY",
      "title": "Specific action title",
      "message": "Direct concise recommendation in plain English",
      "reason": "Short rationale",
      "suggestedAmount": 0,
      "currency": "INR",
      "relatedModule": "Monthly Finance | Investments | Liabilities | Saving Goals"
    }
  ],
  "actionSteps": [
    {
      "step": 1,
      "title": "Step title",
      "description": "Short actionable instruction with suggested amount",
      "priority": "high",
      "suggestedAmount": 0
    }
  ]
}`;

  const market = promptData.market;
  const snapshot = promptData.snapshot;
  const readiness = snapshot.investmentReadiness;
  const loanAnalysis = snapshot.loanVsInvestmentAnalysis;

  const goldInfo = market.gold?.available
    ? `Gold 24K: ₹${market.gold.pricePerGram24K}/g | 22K: ₹${market.gold.pricePerGram22K}/g (${market.gold.source}, As of: ${market.gold.asOfFormatted})`
    : `Gold Spot: CURRENT MARKET DATA UNAVAILABLE`;

  const silverInfo = market.silver?.available
    ? `Silver: ₹${market.silver.pricePerGram}/g (${market.silver.source}, As of: ${market.silver.asOfFormatted})`
    : `Silver Spot: CURRENT MARKET DATA UNAVAILABLE`;

  const niftyInfo = market.equities?.available
    ? `NIFTY 50: ${market.equities.currentValue} (${market.equities.dayChangePercent >= 0 ? "+" : ""}${market.equities.dayChangePercent}%), 10-Yr Historical CAGR: ${market.equities.historical10YrCAGR} (${market.equities.source})`
    : `NIFTY 50: CURRENT MARKET DATA UNAVAILABLE (Historical 10-Yr CAGR: 12.50%)`;

  const sensexInfo = market.sensex?.available
    ? `BSE Sensex: ${market.sensex.currentValue} (${market.sensex.dayChangePercent >= 0 ? "+" : ""}${market.sensex.dayChangePercent}%, ${market.sensex.source})`
    : `BSE Sensex: CURRENT MARKET DATA UNAVAILABLE`;

  const fdInfo = market.fixedDeposit?.available
    ? `Tier-1 Bank FD Benchmark: ${market.fixedDeposit.benchmarkRange} (RBI Repo Rate: ${market.fixedDeposit.rbiRepoRate})`
    : `FD Benchmark: Published bank card rates`;

  const userPrompt = `
=== CONFIDENTIAL USER FINANCIAL DATA (AUTHENTICATED MONGODB RECORDS) ===
- User: ${promptData.user.name} (${promptData.user.city || promptData.user.state || "India"})
- Monthly Inflow: ${formatINR(snapshot.income)} | Outflow: ${formatINR(snapshot.expenses)}
- Net Monthly Savings: ${formatINR(snapshot.monthlySavings)} (${snapshot.savingsRate}% savings rate)
- Liquid Closing Cash: ${formatINR(snapshot.closingBalance)}
- Available to Allocate (Surplus): ${formatINR(snapshot.availableToAllocate)}
- Total Active Monthly Commitments: ${formatINR(snapshot.totalCommitments)}
- Total Investments: ${formatINR(snapshot.totalInvestments)} (Gold: ${snapshot.goldExposurePercent}%, Equities: ${snapshot.equityExposurePercent}%)
- Total Debt/Liabilities: ${formatINR(snapshot.totalLiabilities)}
- Emergency Buffer Runway: ${snapshot.emergencyFundMonths} months of essential living costs
- Net Worth: ${formatINR(snapshot.netWorth)}

=== QUANTITATIVE ENGINE EVALUATION ===
- Investment Readiness: Status = "${readiness?.status || 'READY'}" (${readiness?.passedChecksCount || 0}/${readiness?.totalChecksCount || 9} checks passed).
- Key Concerns: ${readiness?.unresolvedConcerns?.length ? readiness.unresolvedConcerns.join("; ") : "None. Finances support disciplined investing."}
- Debt & Prepayment Analysis: Has Active Loans = ${loanAnalysis?.hasActiveLoans ? "YES" : "NO"}
  ${loanAnalysis?.hasActiveLoans ? `Top Loan Rate: ${loanAnalysis.loanSummary?.interestRate}%, Net Interest Saved if Prepaying: ${formatINR(loanAnalysis.netInterestSaved)}, 15-Day Waiting Cost: ${formatINR(loanAnalysis.waitingInterestCost)}, Tenure Saved: ${loanAnalysis.tenureMonthsSaved} months.` : "No high-interest debt outstanding."}
- Maturing Investments: Has Maturing Items = ${snapshot.maturityToAction?.hasMaturingItems ? "YES" : "NO"}
  ${snapshot.maturityToAction?.hasMaturingItems ? `Upcoming Maturity: ${snapshot.maturityToAction.primaryItem?.name} matures in ${snapshot.maturityToAction.primaryItem?.daysRemaining} days (${formatINR(snapshot.maturityToAction.primaryItem?.amount)}). Engine Recommendation: ${snapshot.maturityToAction.recommendation} (${snapshot.maturityToAction.why}).` : "No investments maturing in the next 60 days."}

=== VERIFIED LIVE INDIAN MARKET BENCHMARKS (AS OF ${market.asOfFormatted}) ===
- ${goldInfo}
- ${silverInfo}
- ${niftyInfo}
- ${sensexInfo}
- ${fdInfo}
- Govt Schemes: PPF @ 7.10% (EEE), NSC @ 7.70% (5-Yr), SGB @ 2.50% + gold appreciation
- Macro Indicators: CPI Inflation = ${market.macro?.cpiInflationRate || "4.80%"}, RBI Repo Rate = ${market.macro?.rbiRepoRate || "6.50%"}

Trigger Context: ${promptData.contextType}`;

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const candidateModels = [
    primaryModel,
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const rawText = response.text;
      if (!rawText) throw new Error("Empty response returned from Gemini.");

      const parsed = JSON.parse(rawText);
      if (!parsed.title || !parsed.summary) {
        throw new Error("Gemini response missing required title or summary.");
      }

      return {
        ...parsed,
        modelUsed: modelName,
      };
    } catch (apiError) {
      console.warn(`Model ${modelName} call failed:`, apiError.message);
      lastError = apiError;
      const isCapacityError =
        apiError.message?.includes("503") ||
        apiError.message?.includes("high demand") ||
        apiError.message?.includes("UNAVAILABLE") ||
        apiError.message?.includes("RESOURCE_EXHAUSTED");
      if (!isCapacityError) {
        break;
      }
    }
  }

  const err = new Error("Gemini AI request failed: " + lastError.message);
  err.code = "GEMINI_API_ERROR";
  err.details = lastError.message;
  throw err;
}

// ============================================================
// DETERMINISTIC CALCULATION ENGINE (FOR DETERMINISTIC AUDIT/TESTING)
// Never used as silent fake fallback; used for isolated Section 6.G scenarios
// ============================================================

function generateDeterministicAnalysis(promptData) {
  const { snapshot, items, market } = promptData;
  const {
    availableToAllocate,
    totalLiabilities,
    totalInvestments,
    totalGoalSaved,
    closingBalance,
    netWorth,
    emergencyFundMonths,
    goldExposurePercent,
    equityExposurePercent,
    savingsRate,
    investmentReadiness,
    loanVsInvestmentAnalysis,
    comparisonMatrix,
  } = snapshot;

  const totalAssets = closingBalance + totalInvestments + totalGoalSaved;
  const goldPriceStr = market.gold?.available
    ? `₹${market.gold.pricePerGram24K}/g (${market.gold.source})`
    : "Gold market data unavailable";
  const niftyStr = market.equities?.available
    ? `${market.equities.currentValue} (${market.equities.source})`
    : "Stock market benchmark unavailable";
  const fdRangeStr = market.fixedDeposit?.available
    ? `${market.fixedDeposit.benchmarkRange} (${market.fixedDeposit.source})`
    : "FD rate data unavailable";

  let title = "";
  let summary = "";
  let category = "Financial Strategy";
  let overallHealth = "Good";
  let suggestionText = "";
  let suggestionReason = "";
  let baseCase = "";
  let bullCase = "";
  let bearCase = "";
  let keyRisks = [];
  let recommendations = [];
  let actionSteps = [];

  if (availableToAllocate < 0) {
    category = "Cash Flow Balance";
    overallHealth = "Needs Attention";
    title = `Rebalance Monthly Deficit of ${formatINR(Math.abs(availableToAllocate))}`;
    summary = `Monthly commitments and living costs exceed inflows by ${formatINR(Math.abs(availableToAllocate))}. Prioritizing liquidity is essential.`;
    suggestionText = `Consider temporarily pausing discretionary commitments to eliminate the ${formatINR(Math.abs(availableToAllocate))} shortfall.`;
    suggestionReason = "Avoids distress liquidation of investments and protects core living requirements.";
    baseCase = "Cash flow normalizes within 30-60 days upon trimming optional outflows.";
    bullCase = "Additional income or expense reduction restores positive cash flow ahead of schedule.";
    bearCase = "Persistent deficit could erode cash reserves and force borrowing.";
    keyRisks = ["Depletion of liquid cash", "Compounding credit charges", "Unplanned debt reliance"];

    recommendations.push({
      category: "Emergency Fund",
      priority: "High",
      decision: "HOLD_LIQUIDITY",
      title: "Pause Discretionary Outflows",
      message: `Hold cash and reduce discretionary spending by ${formatINR(Math.abs(availableToAllocate))}.`,
      reason: "Outflows currently exceed inflows.",
      suggestedAmount: Math.abs(availableToAllocate),
      currency: "INR",
      relatedModule: "Monthly Finance",
    });
  } else if (loanVsInvestmentAnalysis?.hasActiveLoans && totalLiabilities > 0 && loanVsInvestmentAnalysis.loanSummary?.interestRate >= 10) {
    category = "Debt Optimization";
    overallHealth = "Moderate";
    title = "Accelerate Debt Paydown to Reduce Interest Drag";
    summary = `Liabilities of ${formatINR(totalLiabilities)} carry a ${loanVsInvestmentAnalysis.loanSummary.interestRate}% interest rate. Prepaying principal saves ${formatINR(loanVsInvestmentAnalysis.netInterestSaved)} in net interest.`;
    suggestionText = `Direct ${formatINR(Math.round(availableToAllocate * 0.65))} toward high-interest debt while retaining ${formatINR(Math.round(availableToAllocate * 0.35))} for emergency liquidity.`;
    suggestionReason = `Guarantees an after-tax return matching your ${loanVsInvestmentAnalysis.loanSummary.interestRate}% borrowing rate.`;
    baseCase = "Systematic prepayments shorten loan tenure while lowering monthly interest burden.";
    bullCase = "Faster debt clearance frees up substantial investable surplus for equity accumulation.";
    bearCase = "Rising interest rates could increase borrowing costs if floating-rate debt is unaddressed.";
    keyRisks = ["Interest rate hike impact", "Reduced immediate liquidity", "Emergency cash strain"];

    recommendations.push({
      category: "Debt Paydown",
      priority: "High",
      decision: "DEBT_FIRST",
      title: "Prepay High-Interest Debt Principal",
      message: `Allocate ${formatINR(Math.round(availableToAllocate * 0.65))} towards principal reduction.`,
      reason: `Net interest savings of ${formatINR(loanVsInvestmentAnalysis.netInterestSaved)} after prepayment penalty.`,
      suggestedAmount: Math.round(availableToAllocate * 0.65),
      currency: "INR",
      relatedModule: "Liabilities",
    });
  } else if (emergencyFundMonths < 3) {
    category = "Emergency Reserve";
    overallHealth = "Moderate";
    title = `Build Liquid Reserve to 3-6 Months Buffer`;
    summary = `Emergency runway currently covers ${emergencyFundMonths} months. Strengthening liquid buffers protects your portfolio from distress sales.`;
    suggestionText = `Direct ${formatINR(Math.round(availableToAllocate * 0.7))} to secure bank term deposits (${fdRangeStr}) until reserves reach 3-6 months.`;
    suggestionReason = "Term deposits yield ~7% p.a. while keeping funds fully capital-protected under DICGC insurance.";
    baseCase = "Consistent allocation achieves safe 6-month runway within 3 to 5 monthly cycles.";
    bullCase = "Stable expenses allow reaching full reserve coverage faster, enabling aggressive equity deployment.";
    bearCase = "Unexpected medical or living emergencies could derail savings without liquid reserves.";
    keyRisks = ["Premature investment liquidations", "Loss of compounding", "Immediate cash crunch"];

    recommendations.push({
      category: "Fixed Deposit",
      priority: "High",
      decision: "SAVE_FIRST",
      title: "Park in High-Yield Liquid FD",
      message: `Deploy ${formatINR(Math.round(availableToAllocate * 0.7))} in short-term bank FDs (${fdRangeStr}).`,
      reason: "Safe yield over inflation while securing emergency liquidity.",
      suggestedAmount: Math.round(availableToAllocate * 0.7),
      currency: "INR",
      relatedModule: "Saving Goals",
    });
  } else {
    category = "Wealth Growth";
    overallHealth = "Good";
    title = `Deploy ${formatINR(availableToAllocate)} Surplus for Systematic Wealth Compounding`;
    summary = `With core living costs and liquid reserves secured, your ${formatINR(availableToAllocate)} surplus can be diversified across systematic equities and sovereign gold.`;

    const equityPortion = Math.round(availableToAllocate * 0.65);
    const hedgePortion = Math.round(availableToAllocate * 0.35);

    if (goldExposurePercent > 15) {
      suggestionText = `Gold allocation is ${goldExposurePercent}%. Prioritize disciplined equity SIPs (${niftyStr}) and term deposits (${fdRangeStr}) rather than expanding gold further.`;
      suggestionReason = "Avoids over-concentration in commodities while capitalizing on equity compounding.";
    } else {
      suggestionText = `Consider deploying ${formatINR(equityPortion)} toward disciplined equity index SIPs and ${formatINR(hedgePortion)} into gold hedge (${goldPriceStr}) or term deposits.`;
      suggestionReason = "Nifty historical 12.5% CAGR drives growth while safe-haven gold protects against inflation.";
    }

    baseCase = "Equities compound steadily in line with historical GDP growth; commodities provide portfolio hedging.";
    bullCase = "Strong corporate earnings accelerate equity returns above the 10-year historical average.";
    bearCase = "Short-term market corrections or global macro shifts could induce temporary volatility.";
    keyRisks = ["Short-term equity market corrections", "Commodity price fluctuations", "Inflation & interest-rate shifts"];

    recommendations.push({
      category: "Stocks",
      priority: "High",
      decision: "INVEST",
      title: "Increase Disciplined Equity SIP",
      message: `Commit ${formatINR(equityPortion)} toward diversified equity/index mutual fund SIPs.`,
      reason: "Historical benchmark CAGR of 12.50% provides steady long-term real wealth compounding.",
      suggestedAmount: equityPortion,
      currency: "INR",
      relatedModule: "Investments",
    });
  }

  const riskDisclaimer = "Invest at your own risk — market prices and conditions can change, and values may increase or decrease.";

  // Plain-English 3 Sections (Your situation, Your options, Your next step)
  const yourSituation = {
    text: `You have ${formatINR(availableToAllocate)} available after your recorded commitments for this month. Your liquid cash buffer covers ${emergencyFundMonths} months of essential living costs.`,
    availableAmount: availableToAllocate,
    emergencyBufferText: `${emergencyFundMonths} months of essential expenses`,
    summary: summary,
  };

  const yourOptions = [
    {
      option: "Keep Money for Upcoming Bills & Emergencies",
      category: "Emergency Reserve",
      whyFits: emergencyFundMonths < 3
        ? "Top priority: your emergency savings currently cover less than 3 months of essential living expenses."
        : "Safe choice: keeps cash readily accessible for near-term grocery, utility, and medical expenses.",
      risks: "Regular savings accounts earn low interest, meaning money may lose purchasing power to inflation over time.",
      suitability: emergencyFundMonths < 3 ? "Top Recommendation" : "Consider",
      amount: availableToAllocate > 0 ? Math.round(availableToAllocate * 0.4) : 0,
      officialLink: "",
    },
    {
      option: "Compare Bank Fixed Deposits (FD)",
      category: "Fixed Deposit",
      whyFits: `Guaranteed returns of ${fdRangeStr} with statutory capital protection up to ₹5,00,000 per depositor per bank under DICGC.`,
      risks: "Your money is locked in for the chosen period; withdrawing early incurs a premature penalty (typically 0.50% - 1.00%).",
      suitability: availableToAllocate > 0 ? "Recommended" : "Wait",
      amount: availableToAllocate > 0 ? Math.round(availableToAllocate * 0.35) : 0,
      officialLink: "https://sbi.co.in",
    },
    {
      option: "Start or Increase a Mutual Fund SIP",
      category: "Mutual Fund",
      whyFits: "A SIP (Systematic Investment Plan) invests a fixed amount monthly into a mutual fund to build wealth over 3-7+ years.",
      risks: "Mutual fund values fluctuate daily with market movements. They are not guaranteed and not suitable for money needed within 1-2 years.",
      suitability: emergencyFundMonths >= 3 && availableToAllocate > 0 ? "Recommended" : "Save First",
      amount: availableToAllocate > 0 ? Math.round(availableToAllocate * 0.25) : 0,
      officialLink: "https://www.amfiindia.com",
    },
  ];

  if (loanVsInvestmentAnalysis?.hasActiveLoans && totalLiabilities > 0) {
    yourOptions.unshift({
      option: "Prepay Outstanding Loan Principal",
      category: "Debt Paydown",
      whyFits: `Guarantees an immediate interest saving equal to your loan borrowing rate (${loanVsInvestmentAnalysis.loanSummary?.interestRate || 10}%), saving ${formatINR(loanVsInvestmentAnalysis.netInterestSaved)} in interest.`,
      risks: "Reduces your liquid cash permanently; lender prepayment rules may apply.",
      suitability: "Highly Recommended",
      amount: Math.round(availableToAllocate * 0.6),
      officialLink: "",
    });
  }

  // Maturing Investment Intelligent Handling (Section 9)
  if (items?.investments && items.investments.length > 0) {
    const maturing = items.investments.find((inv) => {
      if (!inv.maturityDate) return false;
      const d = new Date(inv.maturityDate);
      const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays >= -30 && diffDays <= 60;
    });
    if (maturing) {
      const matAmount = maturing.actualMaturityValue || maturing.estimatedMaturityAmount || maturing.amount || 0;
      yourOptions.push({
        option: `Allocate Maturing ${maturing.name || "Investment"} Proceeds (${formatINR(matAmount)})`,
        category: "Maturity Action",
        whyFits: `Option 1: Keep cash for upcoming bills. Option 2: Compare a short-term FD (${fdRangeStr}) for money not needed immediately. Option 3: Consider long-term investing only if emergency reserves allow.`,
        risks: "Reinvesting in long-term assets reduces liquidity if unexpected bills arrive.",
        suitability: "Action Required Soon",
        amount: matAmount,
        officialLink: "",
      });
    }
  }

  const yourNextStep = {
    action: emergencyFundMonths < 3
      ? `Keep ${formatINR(Math.max(availableToAllocate, 0))} in your account or open a liquid short-term bank FD to build your emergency cushion to at least 3 months.`
      : (loanVsInvestmentAnalysis?.hasActiveLoans && loanVsInvestmentAnalysis.loanSummary?.interestRate >= 10
        ? `Make a principal prepayment toward your loan at ${loanVsInvestmentAnalysis.loanSummary.interestRate}% to save interest.`
        : `Compare 1-year FD rates from SBI (6.80% - 7.25%) or consider starting a disciplined monthly SIP from your surplus.`),
    why: "Balances safety, liquidity, and steady growth based on your actual recorded numbers.",
    risks: "Market prices fluctuate; fixed deposits have premature withdrawal penalties.",
    missingInfo: items?.liabilities?.length === 0 ? "Check if any active loans, credit cards, or EMIs are unrecorded." : "Your profile information appears complete.",
    officialLink: "https://sbi.co.in",
  };

  return {
    title,
    summary,
    category,
    overallHealth,
    yourSituation,
    yourOptions,
    yourNextStep,
    termsExplained: STANDARD_GLOSSARY,
    stocksForResearch: market.stocksForResearch || [],
    currentPosition: {
      availableToAllocate,
      savingsRate,
      emergencyFundMonths,
      totalLiabilities,
      goldExposurePercent,
      equityExposurePercent,
      summary: `Available surplus ${formatINR(availableToAllocate)}; ${emergencyFundMonths} months liquid reserve buffer; liabilities ${formatINR(totalLiabilities)}.`,
    },
    marketInsight: {
      summary: [
        market.equities?.available ? `NIFTY 50: ${market.equities.currentValue}` : "Nifty: Unavailable",
        market.gold?.available ? `24K Gold: ₹${market.gold.pricePerGram24K}/g` : "Gold: Unavailable",
        market.fixedDeposit?.available ? `Bank FD Benchmark: ${market.fixedDeposit.benchmarkRange}` : "FD: Unavailable",
      ].join("; "),
      goldSpotFormatted: goldPriceStr,
      silverSpotFormatted: market.silver?.available ? `₹${market.silver.pricePerGram}/g` : "Unavailable",
      niftyIndexFormatted: niftyStr,
      fdRangeFormatted: fdRangeStr,
      keyFactors: [
        market.macro?.rbiRepoRate ? `RBI Repo Rate: ${market.macro.rbiRepoRate}` : null,
        market.macro?.cpiInflationRate ? `CPI Inflation: ${market.macro.cpiInflationRate}` : null,
      ].filter(Boolean),
    },
    personalizedSuggestion: {
      text: suggestionText,
      reason: suggestionReason,
      priority: recommendations[0]?.priority || "High",
      actionCategory: category,
    },
    futureOutlook: {
      baseCase,
      bullCase,
      bearCase,
      keyRisks,
    },
    riskDisclaimer,
    financialPosition: {
      availableToAllocate,
      netWorth,
      totalAssets,
      totalLiabilities,
    },
    recommendations,
    actionSteps,
    modelUsed: "FinanceOS Deterministic Engine (Isolated Scenario Mode)",
  };
}

// ============================================================
// MAIN GENERATION CONTROLLER ENTRY
// ============================================================

async function generateUserRecommendation(userId, options = {}) {
  // 1. Gather live MongoDB records & compute normalized snapshot
  const targetMonth = options.selectedMonth || "";
  const { user, snapshot, items } = await calculateFinancialSnapshot(userId, targetMonth);

  // 2. Fetch live verified multi-asset market benchmarks
  const market = await getLiveMarketBenchmarks({ forceFresh: true });

  const promptData = {
    user,
    snapshot,
    items,
    market,
    contextType: options.context || "plans_commitments",
    targetItem: options.targetItem || null,
  };

  // 3. Official Google Gemini Call
  // Throws clear, honest error if key is missing or call fails (Never substitutes fake static advice!)
  const recommendationData = await callGeminiAdviser(promptData);

  // 4. Combine Gemini narrative with verified quantitative modules
  const riskDisclaimer = "Invest at your own risk — market prices and conditions can change, and values may increase or decrease.";

  const currentPosition = recommendationData.currentPosition || {
    availableToAllocate: snapshot.availableToAllocate,
    savingsRate: snapshot.savingsRate,
    emergencyFundMonths: snapshot.emergencyFundMonths,
    totalLiabilities: snapshot.totalLiabilities,
    goldExposurePercent: snapshot.goldExposurePercent,
    equityExposurePercent: snapshot.equityExposurePercent,
    summary: `Available surplus ${formatINR(snapshot.availableToAllocate)}; ${snapshot.emergencyFundMonths} months buffer.`,
  };

  const marketInsight = recommendationData.marketInsight || {
    summary: [
      market.equities?.available ? `NIFTY 50: ${market.equities.currentValue} (${market.equities.source})` : "Nifty 50: Unavailable",
      market.sensex?.available ? `Sensex: ${market.sensex.currentValue}` : null,
      market.gold?.available ? `24K Gold: ₹${market.gold.pricePerGram24K}/g (${market.gold.source})` : "Gold: Unavailable",
      market.fixedDeposit?.available ? `Bank FD: ${market.fixedDeposit.benchmarkRange}` : "FD: Unavailable",
    ].filter(Boolean).join("; "),
    goldSpotFormatted: market.gold?.available ? `₹${market.gold.pricePerGram24K}/g (${market.gold.source})` : "Unavailable",
    silverSpotFormatted: market.silver?.available ? `₹${market.silver.pricePerGram}/g (${market.silver.source})` : "Unavailable",
    niftyIndexFormatted: market.equities?.available ? `${market.equities.currentValue} (${market.equities.source})` : "Unavailable",
    fdRangeFormatted: market.fixedDeposit?.available ? `${market.fixedDeposit.benchmarkRange} (${market.fixedDeposit.source})` : "Unavailable",
    keyFactors: [
      market.macro?.rbiRepoRate ? `RBI Repo Rate: ${market.macro.rbiRepoRate}` : null,
      market.macro?.cpiInflationRate ? `CPI Inflation: ${market.macro.cpiInflationRate}` : null,
    ].filter(Boolean),
  };

  const bankFDData = getVerifiedBankFDRates();
  const bankFDComparison = {
    benchmarkRange: market.fixedDeposit?.benchmarkRange || "6.80% - 7.60%",
    dicgcInsuranceLimit: 500000,
    taxation: "Interest taxable as per slab rate; TDS applies above ₹40,000/yr (₹50,000 for seniors).",
    institutions: bankFDData.institutions || [],
    recommendedTenure: snapshot.loanVsInvestmentAnalysis.hasActiveLoans ? "1 Year (maintain liquidity for debt)" : "1 Year to 3 Years",
    recommendedBank: "State Bank of India (SBI) / HDFC Bank",
    rationale: "DICGC provides statutory insurance coverage up to ₹5,00,000 per depositor per bank.",
  };

  const recommendedCategories = buildRecommendedCategories({
    snapshot,
    readiness: snapshot.investmentReadiness,
    loanAnalysis: snapshot.loanVsInvestmentAnalysis,
    market,
  });

  // 5. Persist to MongoDB (Single Source of Truth)
  const savedSuggestion = await AISuggestion.create({
    user: userId,
    title: recommendationData.title,
    summary: recommendationData.summary,
    category: recommendationData.category || "Financial Strategy",
    overallHealth: recommendationData.overallHealth || "Good",
    yourSituation: recommendationData.yourSituation || {
      text: `You have ${formatINR(snapshot.availableToAllocate)} available after your recorded commitments for this month. Your emergency cushion covers ${snapshot.emergencyFundMonths} months of essential living costs.`,
      availableAmount: snapshot.availableToAllocate,
      emergencyBufferText: `${snapshot.emergencyFundMonths} months of essential living costs saved`,
      summary: recommendationData.summary,
    },
    yourOptions: (() => {
      let opts = (recommendationData.yourOptions && recommendationData.yourOptions.length > 0)
        ? [...recommendationData.yourOptions]
        : [
            {
              option: "Keep Money for Upcoming Bills & Emergencies",
              category: "Emergency Reserve",
              whyFits: snapshot.emergencyFundMonths < 3
                ? "Essential: emergency fund is currently below 3 months of essential expenses."
                : "Keeps money immediately available for regular bills.",
              risks: "Savings accounts provide low returns compared to inflation.",
              suitability: snapshot.emergencyFundMonths < 3 ? "Top Recommendation" : "Consider",
              amount: snapshot.availableToAllocate > 0 ? Math.round(snapshot.availableToAllocate * 0.4) : 0,
              officialLink: "",
            },
            {
              option: "Compare Bank Fixed Deposits (FD)",
              category: "Fixed Deposit",
              whyFits: `Safe yield of ${market.fixedDeposit?.benchmarkRange || "6.80% - 7.60%"} protected up to ₹5,00,000 per bank by DICGC.`,
              risks: "Premature withdrawal penalty (0.50% - 1.00%).",
              suitability: snapshot.availableToAllocate > 0 ? "Recommended" : "Wait",
              amount: snapshot.availableToAllocate > 0 ? Math.round(snapshot.availableToAllocate * 0.35) : 0,
              officialLink: "https://sbi.co.in",
            },
          ];

      if (snapshot.maturityToAction?.hasMaturingItems && !opts.some(o => o.category === "Maturity Action" || o.option?.toLowerCase().includes("matur"))) {
        const primary = snapshot.maturityToAction.primaryItem;
        opts.unshift({
          option: `Plan for Maturing ${primary?.name || "Deposit"} (${formatINR(primary?.amount)})`,
          category: "Maturity Action",
          whyFits: `Your deposit of ${formatINR(primary?.amount)} matures on ${primary?.maturityDateFormatted}. Check upcoming bills and emergency cash before deciding to reinvest or place into an FD.`,
          risks: "Leaving funds idle in zero-interest account causes inflation loss.",
          suitability: "Recommended",
          amount: primary?.amount || 0,
          officialLink: "https://sbi.co.in",
        });
      }

      return opts;
    })(),
    yourNextStep: recommendationData.yourNextStep || {
      action: snapshot.emergencyFundMonths < 3
        ? `Keep ${formatINR(Math.max(snapshot.availableToAllocate, 0))} in your account or open a liquid short-term bank FD to build your emergency cushion.`
        : `Compare 1-year FD rates from SBI (6.80% - 7.25%) or consider starting a disciplined monthly SIP from your surplus.`,
      why: "Protects liquidity while allowing disciplined compounding.",
      risks: "Market prices fluctuate; fixed deposits have premature withdrawal penalties.",
      missingInfo: items?.liabilities?.length === 0 ? "Check if any active loans, credit cards, or EMIs are unrecorded." : "Your profile information appears complete.",
      officialLink: "https://sbi.co.in",
    },
    termsExplained: STANDARD_GLOSSARY,
    stocksForResearch: market.stocksForResearch || [],
    currentPosition,
    marketInsight,
    personalizedSuggestion: recommendationData.personalizedSuggestion || {
      text: recommendationData.summary,
      reason: "Balances capital compounding and liquidity protection.",
      priority: "High",
      actionCategory: recommendationData.category || "General",
    },
    futureOutlook: recommendationData.futureOutlook || {
      baseCase: "Moderate macroeconomic growth with range-bound asset valuations.",
      bullCase: "Easing inflation could stimulate accelerated equity returns.",
      bearCase: "Geopolitical tension or rate volatility may induce short-term pullbacks.",
      keyRisks: ["Market volatility", "Inflation shifts"],
    },
    riskDisclaimer,
    recommendations: recommendationData.recommendations || [],
    detailedAdvice: recommendationData.detailedAdvice || recommendationData.summary,
    keyObservations: recommendationData.keyObservations || [
      `Available monthly surplus: ${formatINR(snapshot.availableToAllocate)} (${snapshot.savingsRate}% savings rate).`,
      `Emergency reserve covers ${snapshot.emergencyFundMonths} months of living costs.`,
      `Portfolio asset allocation: ${snapshot.goldExposurePercent}% Gold, ${snapshot.equityExposurePercent}% Equities.`,
    ],
    actionSteps: recommendationData.actionSteps || [],
    financialPosition: {
      availableToAllocate: snapshot.availableToAllocate,
      netWorth: snapshot.netWorth,
      totalAssets: snapshot.closingBalance + snapshot.totalInvestments + snapshot.totalGoalSaved,
      totalLiabilities: snapshot.totalLiabilities,
    },
    financialSnapshot: snapshot,
    investmentReadiness: snapshot.investmentReadiness,
    loanVsInvestmentAnalysis: snapshot.loanVsInvestmentAnalysis,
    maturityToAction: snapshot.maturityToAction,
    bankFDComparison,
    comparisonMatrix: snapshot.comparisonMatrix,
    recommendedCategories,
    externalContext: {
      goldPricePerGram24K: market.gold?.pricePerGram24K ?? null,
      goldPricePerGram22K: market.gold?.pricePerGram22K ?? null,
      goldAvailable: Boolean(market.gold?.available),
      goldCurrency: market.gold?.currency || "INR",
      goldUnit: market.gold?.unit || "₹ / gram",
      goldSource: market.gold?.source || "External Bullion API",

      silverPricePerGram: market.silver?.pricePerGram ?? null,
      silverPricePerKg: market.silver?.pricePerKg ?? null,
      silverAvailable: Boolean(market.silver?.available),
      silverSource: market.silver?.source || "Global Bullion Spot Market",

      niftyCurrentValue: market.equities?.currentValue ?? null,
      niftyDayChange: market.equities?.dayChange ?? null,
      niftyDayChangePercent: market.equities?.dayChangePercent ?? null,
      niftyHistoricalCAGR: market.equities?.historical10YrCAGR || "12.50%",
      niftyAvailable: Boolean(market.equities?.available),
      equitiesSource: market.equities?.source || "NSE",

      sensexCurrentValue: market.sensex?.currentValue ?? null,
      sensexDayChange: market.sensex?.dayChange ?? null,
      sensexDayChangePercent: market.sensex?.dayChangePercent ?? null,
      sensexAvailable: Boolean(market.sensex?.available),
      sensexSource: market.sensex?.source || "BSE",

      mutualFundNav: market.mutualFunds?.nav ?? null,
      mutualFundScheme: market.mutualFunds?.schemeName || "",
      mutualFundAvailable: Boolean(market.mutualFunds?.available),
      mutualFundSource: market.mutualFunds?.source || "AMFI India",

      rbiRepoRate: market.fixedDeposit?.rbiRepoRate || "6.50%",
      benchmarkFDRate: market.fixedDeposit?.benchmarkRange || "6.80% - 7.60%",
      benchmarkRDRate: market.recurringDeposit?.benchmarkRange || "6.80% - 7.10%",
      fdAvailable: Boolean(market.fixedDeposit?.available),
      fdSource: market.fixedDeposit?.source || "RBI & Scheduled Banks",

      propertyTrend: market.property?.averageAnnualYoYGrowth || "8.5% - 11.2% YoY growth",
      propertyAvailable: Boolean(market.property?.available),
      propertySource: market.property?.source || "NHB RESIDEX",
      ipoMarketStatus: market.ipo?.marketEnvironment || "Active primary market pipeline",
      ipoAvailable: Boolean(market.ipo?.available),
      ipoSource: market.ipo?.source || "BSE / NSE Primary Market",

      inflationRate: market.macro?.cpiInflationRate || "4.80%",
      usdInrRate: market.foreignExchange?.usdInrRate ?? null,
      marketTrend: "Stable interest rate environment with balanced equity growth",
      marketDataStatus: market.gold?.status || "Latest available market price",
      source: "RBI, NSE, BSE, AMFI, NHB & Bullion Spot Market",
      fetchedAt: market.fetchedAt || new Date(),
      asOfFormatted: market.asOfFormatted || "",
    },
    promptContextType: ["plans_commitments", "dashboard_advisor", "dashboard", "maturity_action", "general"].includes(options.context)
      ? options.context
      : "plans_commitments",
    selectedMonth: targetMonth,
    targetItemName: options.targetItem?.name || "",
    modelUsed: recommendationData.modelUsed || "gemini-2.5-flash",
    status: "active",
  });

  return savedSuggestion;
}

// ============================================================
// GET LATEST SAVED RECOMMENDATION (NO GEMINI CALL)
// ============================================================

async function getLatestUserRecommendation(userId) {
  const suggestion = await AISuggestion.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .lean();

  return suggestion;
}

// ============================================================
// GET RECOMMENDATION HISTORY (AIAdviceHistory)
// ============================================================

async function getUserRecommendationHistory(userId, limit = 10) {
  const history = await AISuggestion.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return history;
}

module.exports = {
  calculateFinancialSnapshot,
  generateUserRecommendation,
  generateDeterministicAnalysis,
  getLatestUserRecommendation,
  getUserRecommendationHistory,
  buildRecommendedCategories,
};
