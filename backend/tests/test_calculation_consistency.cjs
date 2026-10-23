// ============================================================
// FINANCEOS - CROSS-MODULE FINANCIAL CALCULATION CONSISTENCY AUDIT
// ============================================================

const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const MonthlyFinance = require("../models/MonthlyFinance");
const Investment = require("../models/Investment");
const Insurance = require("../models/Insurance");
const Liability = require("../models/Liability");
const SavingGoal = require("../models/SavingGoal");
const AdditionalIncome = require("../models/AdditionalIncome");

const { calculateMonthlyCashFlowBreakdown } = require("../utils/cashFlowBreakdown");
const { buildFinancialReportForUser } = require("../controllers/reportController");

const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "financeos_secret_key_2026";

async function runCalculationConsistencyAudit() {
  console.log("============================================================");
  console.log("FINANCEOS - CALCULATION CONSISTENCY & NO DOUBLE-DEDUCTION AUDIT");
  console.log("============================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB:", process.env.MONGO_URI);

  const testResults = [];
  const timestamp = Date.now();

  let testUser, adminUser;
  let userToken, adminToken;

  try {
    // 1. CREATE TEST USER & ADMIN
    testUser = await User.create({
      userId: `USR-CALC-${timestamp}`,
      name: "Calculation Auditor",
      email: `calc_${timestamp}@financeos-test.com`,
      role: "user",
      status: "Active",
      emailVerified: true,
      city: "Mumbai",
      state: "Maharashtra",
    });

    adminUser = await User.findOne({ email: "financeos.system@gmail.com" });
    if (!adminUser) {
      adminUser = await User.create({
        userId: `ADM-CALC-${timestamp}`,
        name: "Admin Auditor",
        email: `admin_calc_${timestamp}@financeos-test.com`,
        role: "admin",
        status: "Active",
        emailVerified: true,
        city: "Mumbai",
        state: "Maharashtra",
      });
    }

    userToken = jwt.sign(
      { id: testUser._id.toString(), userId: testUser.userId, email: testUser.email, role: "user" },
      JWT_SECRET
    );

    adminToken = jwt.sign(
      { id: adminUser._id.toString(), userId: adminUser.userId, email: adminUser.email, role: "admin" },
      JWT_SECRET
    );

    // 2. CONSTRUCT RIGOROUS FINANCIAL STATE FOR 2026-09
    // Opening Balance: 50,000
    // Monthly Salary: 150,000
    // Additional Income (Consulting): 20,000
    // Total Inflows = 50,000 (opening) + 170,000 (inflows) = 220,000
    // Living Expenses: 60,000
    // SIP Paid: 20,000
    // Goal Paid: 15,000
    // Insurance Paid: 10,000
    // Loan EMI Paid: 25,000
    // Total Outflows = 60,000 + 20,000 + 15,000 + 10,000 + 25,000 = 130,000
    // Calculated Closing / Available to Allocate = 220,000 - 130,000 = 90,000
    const OPENING = 50000;
    const SALARY = 150000;
    const ADD_INCOME = 20000;
    const EXPENSES = 60000;
    const SIP_PAID = 20000;
    const GOAL_PAID = 15000;
    const INS_PAID = 10000;
    const EMI_PAID = 25000;

    const EXPECTED_TOTAL_INCOME = SALARY + ADD_INCOME; // 170,000
    const EXPECTED_TOTAL_OUTFLOWS = EXPENSES + SIP_PAID + GOAL_PAID + INS_PAID + EMI_PAID; // 130,000
    const EXPECTED_CLOSING = OPENING + EXPECTED_TOTAL_INCOME - EXPECTED_TOTAL_OUTFLOWS; // 90,000
    const EXPECTED_AVAILABLE = EXPECTED_CLOSING; // 90,000

    // Seed MonthlyFinance
    await MonthlyFinance.create({
      user: testUser._id,
      year: 2026,
      month: 9,
      income: SALARY,
      expenses: EXPENSES,
      openingBalance: OPENING,
      cashBalance: OPENING,
      closingBalance: EXPECTED_CLOSING,
      availableToAllocate: EXPECTED_AVAILABLE,
    });

    // Seed Additional Income
    await AdditionalIncome.create({
      user: testUser._id,
      title: "Consulting Fee",
      category: "Freelancing",
      amount: ADD_INCOME,
      year: 2026,
      month: 9,
      receivedDate: new Date("2026-09-02"),
      date: "2026-09-02",
      status: "Active",
    });

    // Seed SIP Investment (Total asset value 200,000)
    await Investment.create({
      user: testUser._id,
      name: "HDFC Top 100 Index",
      type: "SIP",
      amount: SIP_PAID,
      monthlyContribution: SIP_PAID,
      investedAmount: 180000,
      currentValue: 200000,
      status: "Active",
      sipContributions: [{ dueDate: "2026-09-05", amount: SIP_PAID, status: "Paid" }],
    });

    // Seed Saving Goal (Target 500,000, Saved 100,000)
    await SavingGoal.create({
      user: testUser._id,
      goalName: "Emergency Reserve",
      category: "Emergency Fund",
      targetAmount: 500000,
      targetDate: new Date("2028-12-31"),
      currentAmount: 100000,
      alreadySaved: 100000,
      monthlyContribution: GOAL_PAID,
      status: "Active",
      contributions: [{ date: "2026-09-07", amount: GOAL_PAID }],
    });

    // Seed Insurance (Term Life Policy, sum insured 1,000,000)
    await Insurance.create({
      user: testUser._id,
      name: "HDFC Term Shield",
      type: "Life Insurance",
      sumInsured: 10000000,
      premiumAmount: INS_PAID,
      monthlyEquivalent: INS_PAID,
      status: "Active",
      payments: [{ paidDate: "2026-09-10", amount: INS_PAID, status: "Paid" }],
    });

    // Seed Liability (Home Loan: Remaining 1,500,000)
    await Liability.create({
      user: testUser._id,
      name: "SBI Home Loan",
      type: "Home Loan",
      principalAmount: 2000000,
      remainingAmount: 1500000,
      monthlyEMI: EMI_PAID,
      status: "Active",
      payments: [{ paidDate: "2026-09-15", amount: EMI_PAID, status: "Paid" }],
    });

    // Net Worth = Assets - Liabilities
    // Assets = Closing Cash (90,000) + Investments (200,000) + Goals (100,000) = 390,000
    // Liabilities = 1,500,000
    // Net Worth = 390,000 - 1,500,000 = -1,110,000
    const EXPECTED_TOTAL_ASSETS = EXPECTED_CLOSING + 200000 + 100000; // 390,000
    const EXPECTED_TOTAL_LIABILITIES = 1500000;
    const EXPECTED_NET_WORTH = EXPECTED_TOTAL_ASSETS - EXPECTED_TOTAL_LIABILITIES; // -1,110,000

    // ------------------------------------------------------------
    // TEST 1: Cash Flow Breakdown Engine Verification
    // ------------------------------------------------------------
    console.log("--- TEST 1: Cash Flow Breakdown Engine Calculation ---");
    const breakdown = await calculateMonthlyCashFlowBreakdown({
      userId: testUser._id,
      year: 2026,
      month: 9,
    });

    const pass1 =
      breakdown.openingBalance?.amount === OPENING &&
      breakdown.inflow?.totalIncome === EXPECTED_TOTAL_INCOME &&
      breakdown.outflows?.expenses === EXPENSES &&
      breakdown.outflows?.investments === SIP_PAID &&
      breakdown.outflows?.goalContributions === GOAL_PAID &&
      breakdown.outflows?.insurancePayments === INS_PAID &&
      breakdown.outflows?.liabilityPayments === EMI_PAID &&
      breakdown.outflows?.totalActualOutflows === EXPECTED_TOTAL_OUTFLOWS &&
      breakdown.closingBalance === EXPECTED_CLOSING &&
      breakdown.availableToAllocate === EXPECTED_AVAILABLE;

    console.log(`Test 1 Result: ${pass1 ? "PASS" : "FAIL"}`);
    console.log(`  Opening Balance: ₹${breakdown.openingBalance?.amount} (Expected: ${OPENING})`);
    console.log(`  Total Income: ₹${breakdown.inflow?.totalIncome} (Expected: ${EXPECTED_TOTAL_INCOME})`);
    console.log(`  Total Outflows: ₹${breakdown.outflows?.totalActualOutflows} (Expected: ${EXPECTED_TOTAL_OUTFLOWS})`);
    console.log(`  Closing Balance: ₹${breakdown.closingBalance} (Expected: ${EXPECTED_CLOSING})`);
    console.log(`  Available to Allocate: ₹${breakdown.availableToAllocate} (Expected: ${EXPECTED_AVAILABLE})`);
    testResults.push({ name: "1. Authoritative Cash Flow Breakdown Engine", pass: pass1 });

    // ------------------------------------------------------------
    // TEST 2: Zero Double-Deduction Verification
    // ------------------------------------------------------------
    console.log("\n--- TEST 2: Verification of Zero Double-Deduction ---");
    // Verify that living expenses (60,000) does NOT include the commitments (70,000)
    // and totalActualOutflows (130,000) is exactly sum of parts without duplicates
    const sumOfIndividualOutflows =
      breakdown.outflows.expenses +
      breakdown.outflows.investments +
      breakdown.outflows.goalContributions +
      breakdown.outflows.insurancePayments +
      breakdown.outflows.liabilityPayments;

    const noDoubleDeduction =
      sumOfIndividualOutflows === breakdown.outflows.totalActualOutflows &&
      breakdown.outflows.totalActualOutflows === EXPECTED_TOTAL_OUTFLOWS;

    console.log(`Test 2 Result: ${noDoubleDeduction ? "PASS" : "FAIL"}`);
    console.log(`  Sum of distinct outflow components: ₹${sumOfIndividualOutflows}`);
    console.log(`  Total actual recorded outflows: ₹${breakdown.outflows.totalActualOutflows}`);
    console.log(`  Double deduction detected: ${!noDoubleDeduction}`);
    testResults.push({ name: "2. Zero Double-Deduction Across Commitments", pass: noDoubleDeduction });

    // ------------------------------------------------------------
    // TEST 3: Reports Module Calculation Alignment
    // ------------------------------------------------------------
    console.log("\n--- TEST 3: Reports Module Calculation Match ---");
    const userReport = await buildFinancialReportForUser(testUser._id, {
      duration: "monthly",
      year: 2026,
      month: 9,
    });

    const repSummary = userReport.financialSummary;
    const pass3 =
      repSummary.openingBalance === OPENING &&
      repSummary.totalIncome === EXPECTED_TOTAL_INCOME &&
      repSummary.totalExpenses === EXPENSES &&
      repSummary.closingBalance === EXPECTED_CLOSING &&
      repSummary.availableToAllocate === EXPECTED_AVAILABLE;

    console.log(`Test 3 Result: ${pass3 ? "PASS" : "FAIL"}`);
    console.log(`  Report Opening: ₹${repSummary.openingBalance}`);
    console.log(`  Report Income: ₹${repSummary.totalIncome}`);
    console.log(`  Report Expenses: ₹${repSummary.totalExpenses}`);
    console.log(`  Report Closing: ₹${repSummary.closingBalance}`);
    console.log(`  Report Available to Allocate: ₹${repSummary.availableToAllocate}`);
    testResults.push({ name: "3. Reports Calculation Alignment", pass: pass3 });

    // ------------------------------------------------------------
    // TEST 4: Admin Financial View Calculation Match
    // ------------------------------------------------------------
    console.log("\n--- TEST 4: Admin User Financial View Alignment ---");
    const resAdminFin = await fetch(`${BASE_URL}/api/admin/users/${testUser._id}/financial?year=2026&month=9`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dataAdminFin = await resAdminFin.json();

    const adminSummary = dataAdminFin.summary;
    const pass4 =
      resAdminFin.status === 200 &&
      adminSummary.openingBalance === OPENING &&
      adminSummary.income === EXPECTED_TOTAL_INCOME &&
      adminSummary.expenses === EXPENSES &&
      adminSummary.closingBalance === EXPECTED_CLOSING &&
      adminSummary.availableToAllocate === EXPECTED_AVAILABLE;

    console.log(`Test 4 Result: ${pass4 ? "PASS" : "FAIL"}`);
    console.log(`  Admin View Income: ₹${adminSummary.income}`);
    console.log(`  Admin View Expenses: ₹${adminSummary.expenses}`);
    console.log(`  Admin View Closing: ₹${adminSummary.closingBalance}`);
    console.log(`  Admin View Available: ₹${adminSummary.availableToAllocate}`);
    testResults.push({ name: "4. Admin User Financial View Alignment", pass: pass4 });

    // ------------------------------------------------------------
    // TEST 5: Monthly Finance API Alignment
    // ------------------------------------------------------------
    console.log("\n--- TEST 5: Monthly Finance API Endpoint Alignment ---");
    const resMonthly = await fetch(`${BASE_URL}/api/monthly-finance/2026/9`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const dataMonthly = await resMonthly.json();

    const record = dataMonthly.finance;
    const pass5 =
      resMonthly.status === 200 &&
      record.income === SALARY &&
      record.expenses === EXPENSES &&
      record.openingBalance === OPENING &&
      record.closingBalance === EXPECTED_CLOSING &&
      (dataMonthly.availableToAllocate === EXPECTED_AVAILABLE || record.availableToAllocate === EXPECTED_AVAILABLE);

    console.log(`Test 5 Result: ${pass5 ? "PASS" : "FAIL"}`);
    console.log(`  Monthly Record Closing: ₹${record.closingBalance}`);
    console.log(`  Monthly Record Available: ₹${record.availableToAllocate}`);
    testResults.push({ name: "5. Monthly Finance API Record Alignment", pass: pass5 });

    // ------------------------------------------------------------
    // TEST 6: Net Worth Calculation Across All Modules
    // ------------------------------------------------------------
    console.log("\n--- TEST 6: Net Worth Integrity Check ---");
    const repNetWorth = userReport.netWorthSummary?.closingNetWorth;
    const repTotalAssets = userReport.netWorthSummary?.totalAssets;
    const repTotalLiabilities = userReport.netWorthSummary?.totalLiabilities;

    const pass6 =
      repTotalAssets === EXPECTED_TOTAL_ASSETS &&
      repTotalLiabilities === EXPECTED_TOTAL_LIABILITIES &&
      repNetWorth === EXPECTED_NET_WORTH;

    console.log(`Test 6 Result: ${pass6 ? "PASS" : "FAIL"}`);
    console.log(`  Assets: ₹${repTotalAssets} (Expected: ${EXPECTED_TOTAL_ASSETS})`);
    console.log(`  Liabilities: ₹${repTotalLiabilities} (Expected: ${EXPECTED_TOTAL_LIABILITIES})`);
    console.log(`  Net Worth: ₹${repNetWorth} (Expected: ${EXPECTED_NET_WORTH})`);
    testResults.push({ name: "6. Net Worth Authoritative Calculation", pass: pass6 });

  } finally {
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await MonthlyFinance.deleteMany({ user: testUser._id });
      await AdditionalIncome.deleteMany({ user: testUser._id });
      await Investment.deleteMany({ user: testUser._id });
      await SavingGoal.deleteMany({ user: testUser._id });
      await Insurance.deleteMany({ user: testUser._id });
      await Liability.deleteMany({ user: testUser._id });
    }
    if (adminUser && adminUser.email !== "financeos.system@gmail.com") {
      await User.deleteOne({ _id: adminUser._id });
    }
    await mongoose.disconnect();
  }

  console.log("\n============================================================");
  console.log("CALCULATION CONSISTENCY AUDIT SUMMARY");
  console.log("============================================================");
  let allPass = true;
  testResults.forEach((t) => {
    console.log(`- [${t.pass ? "PASS" : "FAIL"}] ${t.name}`);
    if (!t.pass) allPass = false;
  });
  console.log("============================================================");
  console.log(`FINAL CALCULATION RESULT: ${allPass ? "ALL TESTS PASSED (6/6)" : "FAILURES DETECTED"}`);
  console.log("============================================================\n");

  if (!allPass) process.exit(1);
}

runCalculationConsistencyAudit().catch((err) => {
  console.error("Fatal Test Error:", err);
  process.exit(1);
});
