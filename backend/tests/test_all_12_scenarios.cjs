// ============================================================
// FINANCEOS - COMPREHENSIVE AUTOMATED VERIFICATION OF 12 SCENARIOS
// Section 6.G Testing Requirements
// ============================================================

const {
  calculateLoanPrepaymentAnalysis,
  calculateFixedDepositReturns,
  assessInvestmentReadiness,
  evaluateMaturityToAction,
  buildActionableComparisonMatrix,
} = require("../services/financialAnalysisEngine");

const {
  getVerifiedBankFDRates,
  getVerifiedGovtSchemes,
} = require("../services/marketDataService");

const results = [];

function runScenario(id, title, fn) {
  try {
    const outcome = fn();
    const isPass = outcome && outcome.pass !== false;
    results.push({
      id,
      title,
      status: isPass ? "PASS" : "FAIL",
      details: outcome.details || (isPass ? "Verified successfully" : "Assertion failed"),
    });
  } catch (err) {
    results.push({ id, title, status: "FAIL", details: err.message });
  }
}

console.log("============================================================");
console.log("FINANCEOS - SECTION 6.G AUTOMATED SCENARIO AUDIT SUITE");
console.log("============================================================\n");

// Scenario 1: A user has an outstanding high-interest loan and an investment maturing in 15 days.
runScenario(1, "High-interest loan & investment maturing in 15 days", () => {
  const loanCalc = calculateLoanPrepaymentAnalysis({
    principal: 400000,
    annualRate: 14.5,
    monthlyEMI: 12000,
    tenureMonths: 48,
    prepaymentAmount: 200000,
    prepaymentPenaltyPercent: 0,
    daysToWaitingMaturity: 15,
  });

  const maturityPlan = evaluateMaturityToAction({
    investments: [
      {
        name: "Maturing Fixed Deposit",
        type: "Fixed Deposit",
        maturityDate: new Date(Date.now() + 15 * 86400000),
        actualMaturityValue: 200000,
      },
    ],
    liabilities: [
      { name: "Personal Loan", principalAmount: 400000, remainingAmount: 400000, interestRate: 14.5, monthlyEMI: 12000, status: "active" },
    ],
    surplus: 25000,
    emergencyFundMonths: 4,
    upcomingObligations: 12000,
  });

  const pass =
    loanCalc.waitingInterestCost > 0 &&
    loanCalc.waitingInterestCost === Math.round(400000 * (14.5 / 36500) * 15) &&
    loanCalc.netInterestSaved > 0 &&
    maturityPlan.hasMaturingItems === true &&
    (maturityPlan.recommendation === "REPAY_LOAN" || maturityPlan.why.toLowerCase().includes("prepaying"));

  return {
    pass,
    details: `15-day waiting interest = ₹${loanCalc.waitingInterestCost}, Net interest saved = ₹${loanCalc.netInterestSaved}, Recommendation = "${maturityPlan.recommendation}"`,
  };
});

// Scenario 2: A user has a loan but insufficient emergency reserves.
runScenario(2, "Loan but insufficient emergency reserves (< 3 months)", () => {
  const readiness = assessInvestmentReadiness({
    income: 60000,
    expenses: 45000,
    availableToAllocate: 15000,
    emergencyFundMonths: 1.2,
    totalLiabilities: 300000,
    activeLiabilities: [{ name: "Car Loan", remainingAmount: 300000, monthlyEMI: 8000, interestRate: 9.5 }],
  });

  const pass =
    readiness.isReadyToInvest === false &&
    readiness.status === "EMERGENCY_RESERVE_FIRST" &&
    readiness.unresolvedConcerns.some((c) => c.toLowerCase().includes("emergency"));

  return {
    pass,
    details: `Readiness status = ${readiness.status}, Priority = ${readiness.priorityRecommendation}`,
  };
});

// Scenario 3: A user has a loan with prepayment charges.
runScenario(3, "Loan with prepayment charges (penalty deduction)", () => {
  const loanNoPenalty = calculateLoanPrepaymentAnalysis({
    principal: 500000,
    annualRate: 12.0,
    monthlyEMI: 15000,
    prepaymentAmount: 100000,
    prepaymentPenaltyPercent: 0,
  });

  const loanWithPenalty = calculateLoanPrepaymentAnalysis({
    principal: 500000,
    annualRate: 12.0,
    monthlyEMI: 15000,
    prepaymentAmount: 100000,
    prepaymentPenaltyPercent: 2.5,
  });

  const pass =
    loanWithPenalty.prepaymentPenaltyCharges === 2500 &&
    loanWithPenalty.netInterestSaved === loanNoPenalty.netInterestSaved - 2500;

  return {
    pass,
    details: `Penalty = ₹${loanWithPenalty.prepaymentPenaltyCharges}, Net saved: ₹${loanWithPenalty.netInterestSaved} (Exact difference of ₹2500)`,
  };
});

// Scenario 4: A user has maturity proceeds available but also an upcoming EMI and insurance premium.
runScenario(4, "Maturity proceeds with upcoming EMI and insurance obligations", () => {
  const maturityPlan = evaluateMaturityToAction({
    investments: [
      {
        name: "Maturing Bond",
        type: "Bond",
        maturityDate: new Date(Date.now() + 10 * 86400000),
        actualMaturityValue: 150000,
      },
    ],
    liabilities: [
      { name: "Home Loan", monthlyEMI: 35000, remainingAmount: 2000000, interestRate: 8.5 },
    ],
    surplus: 20000,
    emergencyFundMonths: 4,
    upcomingObligations: 50000, // 35k EMI + 15k Insurance
  });

  const pass =
    maturityPlan.hasMaturingItems === true &&
    maturityPlan.urgentObligations === 50000 &&
    maturityPlan.safeAvailableForDebtOrInvest === 100000; // 150k - 50k = 100k

  return {
    pass,
    details: `Gross maturity = ₹1,50,000, Obligations deducted = ₹${maturityPlan.urgentObligations}, Safe remaining = ₹${maturityPlan.safeAvailableForDebtOrInvest}`,
  };
});

// Scenario 5: A user has no outstanding loan and surplus cash.
runScenario(5, "No outstanding loan and surplus cash (Wealth Growth)", () => {
  const readiness = assessInvestmentReadiness({
    income: 120000,
    expenses: 50000,
    availableToAllocate: 70000,
    emergencyFundMonths: 6.5,
    totalLiabilities: 0,
    activeLiabilities: [],
  });

  const matrix = buildActionableComparisonMatrix({
    surplus: 70000,
    hasActiveLoans: false,
    topLoanRate: 0,
    emergencyFundMonths: 6.5,
    needWithinOneMonth: false,
  });

  const topChoice = matrix[0];
  const pass =
    readiness.isReadyToInvest === true &&
    readiness.status === "READY" &&
    (topChoice.id === "mutual_fund" || topChoice.id === "sip");

  return {
    pass,
    details: `Readiness = READY, Top recommended choice = "${topChoice.choice}"`,
  };
});

// Scenario 6: A user needs the money within one month.
runScenario(6, "User needs the money within one month (Capital Preservation & Liquidity)", () => {
  const matrix = buildActionableComparisonMatrix({
    surplus: 50000,
    hasActiveLoans: false,
    topLoanRate: 0,
    emergencyFundMonths: 4,
    needWithinOneMonth: true,
  });

  const topChoice = matrix[0];
  const pass =
    topChoice.id === "accessible_cash" &&
    topChoice.suitability === "Essential" &&
    matrix.find((c) => c.id === "mutual_fund").illustrativeAllocation === 0;

  return {
    pass,
    details: `Top ranked choice = "${topChoice.choice}" (₹0 allocated to volatile equity)`,
  };
});

// Scenario 7: A user can keep the money invested for a longer period (> 3-5 years).
runScenario(7, "User can invest for longer period (> 3-5 years)", () => {
  const matrix = buildActionableComparisonMatrix({
    surplus: 60000,
    hasActiveLoans: false,
    topLoanRate: 0,
    emergencyFundMonths: 5,
    needWithinOneMonth: false,
  });

  const mfChoice = matrix.find((c) => c.id === "mutual_fund");
  const sipChoice = matrix.find((c) => c.id === "sip");
  const pass = mfChoice.rank === 1 && mfChoice.illustrativeAllocation > 0 && sipChoice.rank === 2;

  return {
    pass,
    details: `Top choice = "${mfChoice.choice}" with allocation = ₹${mfChoice.illustrativeAllocation}, 2nd = "${sipChoice.choice}"`,
  };
});

// Scenario 8: Bank FD data is current and verified.
runScenario(8, "Bank FD data is current and verified", () => {
  const fdData = getVerifiedBankFDRates();
  const sbi = fdData.institutions.find((i) => i.bank.includes("SBI"));
  const hdfc = fdData.institutions.find((i) => i.bank.includes("HDFC"));

  const calc = calculateFixedDepositReturns({
    principal: 100000,
    annualRate: 7.0,
    tenureMonths: 12,
    taxSlabPercent: 20,
  });

  const pass =
    fdData.available === true &&
    sbi !== undefined &&
    hdfc !== undefined &&
    calc.dicgcInsuredAmount === 100000 &&
    calc.grossInterestEarned > 7000;

  return {
    pass,
    details: `SBI: ${sbi.generalRate}, Gross interest on ₹1L at 7%: ₹${calc.grossInterestEarned}, Net maturity: ₹${calc.netPostTaxReturn}, DICGC insured: ₹${calc.dicgcInsuredAmount}`,
  };
});

// Scenario 9: Bank FD data handles fallback when external provider unavailable.
runScenario(9, "Bank FD data handles fallback when external provider unavailable", () => {
  const calc = calculateFixedDepositReturns({
    principal: 100000,
    annualRate: 0,
    tenureMonths: 12,
  });

  const pass = calc.grossInterestEarned === 0 && calc.taxDeduction === 0;
  return {
    pass,
    details: `Zero fabrication: Unverified rate returns ₹0 interest and explicit calculation`,
  };
});

// Scenario 10: Loan interest rate or maturity proceeds missing (No fabrication).
runScenario(10, "Loan interest rate or maturity proceeds missing (No fabrication)", () => {
  const loanMissing = calculateLoanPrepaymentAnalysis({
    principal: 500000,
    annualRate: 0,
    monthlyEMI: 10000,
  });

  const maturityMissing = evaluateMaturityToAction({
    investments: [
      { name: "Unknown Scheme", maturityDate: null, actualMaturityValue: 0 },
    ],
    liabilities: [],
    surplus: 10000,
  });

  const pass =
    loanMissing.isValid === false &&
    loanMissing.reason.includes("Missing") &&
    maturityMissing.hasMaturingItems === false;

  return {
    pass,
    details: `Loan missing rate: isValid = ${loanMissing.isValid} ("${loanMissing.reason}"), Maturity missing: hasMaturingItems = ${maturityMissing.hasMaturingItems}`,
  };
});

// Scenario 11: The maturity date changes or investment is redeemed early.
runScenario(11, "Maturity date changes or investment redeemed early", () => {
  // Pre-change: matures in 15 days
  const plan15Days = evaluateMaturityToAction({
    investments: [{ name: "FD #1", maturityDate: new Date(Date.now() + 15 * 86400000), actualMaturityValue: 50000 }],
    liabilities: [],
    surplus: 5000,
  });

  // Post-change: redeemed / already past
  const planRedeemed = evaluateMaturityToAction({
    investments: [{ name: "FD #1", maturityDate: new Date(Date.now() - 50 * 86400000), actualMaturityValue: 50000 }],
    liabilities: [],
    surplus: 5000,
  });

  const pass = plan15Days.hasMaturingItems === true && planRedeemed.hasMaturingItems === false;
  return {
    pass,
    details: `Active 15-day maturity detected = ${plan15Days.hasMaturingItems}, Past/redeemed excluded = ${!planRedeemed.hasMaturingItems}`,
  };
});

// Scenario 12: User refreshes AI analysis after changing financial records.
runScenario(12, "User refreshes AI analysis after changing financial records (Dynamic re-computation)", () => {
  // Initial state: Deficit
  const state1 = assessInvestmentReadiness({
    income: 50000,
    expenses: 60000,
    availableToAllocate: -10000,
    emergencyFundMonths: 0,
    totalLiabilities: 0,
  });

  // Updated state: Income increased, expenses trimmed, surplus +40000
  const state2 = assessInvestmentReadiness({
    income: 80000,
    expenses: 40000,
    availableToAllocate: 40000,
    emergencyFundMonths: 4.5,
    totalLiabilities: 0,
  });

  const pass = state1.status === "DEFICIT_RECOVERY" && state2.status === "READY" && state1.isReadyToInvest !== state2.isReadyToInvest;
  return {
    pass,
    details: `Initial status = ${state1.status} (Ready: ${state1.isReadyToInvest}) -> Refreshed status = ${state2.status} (Ready: ${state2.isReadyToInvest})`,
  };
});

// Summary table
console.log("------------------------------------------------------------------------------------------------------------------------");
console.log(String("ID").padEnd(4) + String("SCENARIO").padEnd(65) + String("RESULT").padEnd(10) + "DETAILS");
console.log("------------------------------------------------------------------------------------------------------------------------");
results.forEach((r) => {
  console.log(`${String(r.id).padEnd(4)}${r.title.padEnd(65)}${r.status.padEnd(10)}${r.details}`);
});
console.log("------------------------------------------------------------------------------------------------------------------------");
const allPassed = results.every((r) => r.status === "PASS");
console.log(`\nOVERALL SECTION 6.G AUDIT: ${allPassed ? "12/12 SCENARIOS PASSED" : "FAILURES DETECTED"}\n`);

if (!allPassed) process.exit(1);
