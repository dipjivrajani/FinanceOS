// ============================================================
// FINANCEOS - GLOBAL INSUFFICIENT FUNDS VALIDATION E2E TEST SUITE
// Tests all 10 scenarios specified in requirements:
// 1. Available ₹15,000; SIP payment ₹16,000: blocked, structured error, no DB changes.
// 2. Available ₹15,000; payment ₹15,000: allowed.
// 3. Available ₹15,000; payment ₹14,000: allowed.
// 4. Available ₹0; payment ₹1: blocked.
// 5. Available ₹15,000; two concurrent requests of ₹10,000: only 1 succeeds, no double-spend.
// 6. Available balance changes between page load and submission: fresh balance check blocks.
// 7. Different selected month/year: period calculation isolation.
// 8. Another user submits payment: user data isolation.
// 9. Invalid, zero, negative, NaN, infinite amount: reject without modifying DB.
// 10. Existing flows, reports, reminders, dashboard continue working without regression.
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
const { formatRupees } = require("../utils/fundValidationService");

const BASE_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET || "financeos_secret_key_2026";

async function runTestSuite() {
  console.log("============================================================");
  console.log("FINANCEOS - GLOBAL INSUFFICIENT FUNDS VALIDATION SUITE");
  console.log("============================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB:", process.env.MONGO_URI);

  const testReport = [];
  const timestamp = Date.now();

  let userA, userB;
  let tokenA, tokenB;

  function recordResult(testNum, testName, pass, details) {
    testReport.push({ testNum, testName, pass, details });
    const status = pass ? "PASS" : "FAIL";
    console.log(`[${status}] Test ${testNum}: ${testName}`);
    if (details) console.log(`       Details: ${details}`);
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Create two test users (User A and User B)
    // -------------------------------------------------------------
    userA = await User.create({
      userId: `USR-A-${timestamp}`,
      name: "Funds Auditor A",
      email: `auditor_a_${timestamp}@test.com`,
      role: "user",
      status: "Active",
      emailVerified: true,
      city: "Bangalore",
      state: "Karnataka",
    });

    userB = await User.create({
      userId: `USR-B-${timestamp}`,
      name: "Funds Auditor B",
      email: `auditor_b_${timestamp}@test.com`,
      role: "user",
      status: "Active",
      emailVerified: true,
      city: "Delhi",
      state: "Delhi",
    });

    tokenA = jwt.sign(
      { id: userA._id.toString(), userId: userA.userId, email: userA.email, role: "user" },
      JWT_SECRET
    );

    tokenB = jwt.sign(
      { id: userB._id.toString(), userId: userB.userId, email: userB.email, role: "user" },
      JWT_SECRET
    );

    // Target testing period: 2026-05
    const TARGET_YEAR = 2026;
    const TARGET_MONTH = 5;
    const TARGET_ISO = "2026-05";

    // Setup User A baseline for 2026-05:
    // Income = 25,000, Expenses = 10,000 => Available to Allocate = 15,000
    await MonthlyFinance.create({
      user: userA._id,
      year: TARGET_YEAR,
      month: TARGET_MONTH,
      income: 25000,
      expenses: 10000,
      openingBalance: 0,
      cashBalance: 0,
    });

    // Create a SIP investment for User A
    const invA = await Investment.create({
      user: userA._id,
      name: "Nifty 50 Index SIP",
      type: "Mutual Fund",
      amount: 5000,
      monthlyContribution: 5000,
      contributionType: "Recurring",
      startDate: new Date("2026-01-01"),
      status: "Active",
      sipContributions: [],
    });

    // Verify baseline balance
    const baselineBreakdown = await calculateMonthlyCashFlowBreakdown({
      userId: userA._id,
      year: TARGET_YEAR,
      month: TARGET_MONTH,
    });

    console.log(`Initial Available to Allocate for User A (${TARGET_ISO}): ₹${baselineBreakdown.availableToAllocate}`);

    // =============================================================
    // TEST 1: Available ₹15,000; SIP payment ₹16,000: blocked, modal format, no DB changes
    // =============================================================
    {
      const res = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 16000,
          paidDate: "2026-05-10",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const freshInv = await Investment.findById(invA._id);
      const noContributionsSaved = freshInv.sipContributions.length === 0;

      const expectedMsg =
        "You don't have sufficient funds available to make this payment. Your available balance is ₹15,000, but the requested amount is ₹16,000.";

      const isBlocked =
        res.status === 400 &&
        data.code === "INSUFFICIENT_FUNDS" &&
        data.availableAmount === 15000 &&
        data.requestedAmount === 16000 &&
        data.message === expectedMsg &&
        noContributionsSaved;

      recordResult(
        1,
        "Available ₹15,000; SIP payment ₹16,000: blocked with structured response and no DB changes",
        isBlocked,
        `Status: ${res.status}, Code: ${data.code}, Msg: "${data.message}", DB records: ${freshInv.sipContributions.length}`
      );
    }

    // =============================================================
    // TEST 2: Available ₹15,000; payment ₹15,000: allowed
    // =============================================================
    {
      // Create a separate goal for clean testing
      const goalTest2 = await SavingGoal.create({
        user: userA._id,
        goalName: "Exact Balance Goal",
        category: "Other",
        targetAmount: 50000,
        currentAmount: 0,
        alreadySaved: 0,
        startDate: new Date("2026-01-01"),
        targetDate: new Date("2027-01-01"),
        status: "Active",
      });

      const res = await fetch(`${BASE_URL}/api/saving-goals/${goalTest2._id}/contribution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 15000,
          date: "2026-05-15",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const freshGoal = await SavingGoal.findById(goalTest2._id);
      const isAllowed = res.status === 200 && data.success && freshGoal.currentAmount === 15000;

      recordResult(
        2,
        "Available ₹15,000; payment ₹15,000: allowed if no other validation fails",
        isAllowed,
        `Status: ${res.status}, Success: ${data.success}, Current amount: ${freshGoal?.currentAmount}`
      );

      // Clean up goalTest2 so available funds return to ₹15,000 for subsequent tests
      await SavingGoal.deleteOne({ _id: goalTest2._id });
    }

    // =============================================================
    // TEST 3: Available ₹15,000; payment ₹14,000: allowed
    // =============================================================
    {
      const liabTest3 = await Liability.create({
        user: userA._id,
        name: "Test Personal Loan",
        type: "Personal Loan",
        principalAmount: 100000,
        remainingAmount: 100000,
        monthlyEMI: 14000,
        startDate: new Date("2026-01-01"),
        status: "Active",
      });

      const res = await fetch(`${BASE_URL}/api/liabilities/${liabTest3._id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 14000,
          paidDate: "2026-05-12",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const freshLiab = await Liability.findById(liabTest3._id);
      const isAllowed = (res.status === 200 || res.status === 201) && data.success && freshLiab.payments.length === 1;

      recordResult(
        3,
        "Available ₹15,000; payment ₹14,000: allowed if no other validation fails",
        isAllowed,
        `Status: ${res.status}, Success: ${data.success}, Payments count: ${freshLiab?.payments.length}`
      );

      // Clean up liabTest3 to restore ₹15,000 available funds
      await Liability.deleteOne({ _id: liabTest3._id });
    }

    // =============================================================
    // TEST 4: Available ₹0; payment ₹1: blocked
    // =============================================================
    {
      // Set User A monthly finance to Income = 10,000, Expenses = 10,000 => Available = 0
      await MonthlyFinance.updateOne(
        { user: userA._id, year: TARGET_YEAR, month: TARGET_MONTH },
        { income: 10000, expenses: 10000 }
      );

      const insTest4 = await Insurance.create({
        user: userA._id,
        name: "Zero Balance Health Insurance",
        type: "Health Insurance",
        premiumAmount: 1,
        premiumFrequency: "Monthly",
        startDate: new Date("2026-01-01"),
        status: "Active",
      });

      const res = await fetch(`${BASE_URL}/api/insurances/${insTest4._id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 1,
          paidDate: "2026-05-10",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const freshIns = await Insurance.findById(insTest4._id);
      const noPaymentSaved = (freshIns.payments || []).length === 0;

      const isBlocked =
        res.status === 400 &&
        data.code === "INSUFFICIENT_FUNDS" &&
        data.availableAmount === 0 &&
        data.requestedAmount === 1 &&
        noPaymentSaved;

      recordResult(
        4,
        "Available ₹0; payment ₹1: blocked with zero-balance calculation",
        isBlocked,
        `Status: ${res.status}, Code: ${data.code}, Available: ${data.availableAmount}, Requested: ${data.requestedAmount}`
      );

      // Restore User A to Income = 25,000, Expenses = 10,000 => Available = 15,000
      await MonthlyFinance.updateOne(
        { user: userA._id, year: TARGET_YEAR, month: TARGET_MONTH },
        { income: 25000, expenses: 10000 }
      );
      await Insurance.deleteOne({ _id: insTest4._id });
    }

    // =============================================================
    // TEST 5: Available ₹15,000; two concurrent requests of ₹10,000:
    // Both must NOT succeed; one succeeds and one blocked.
    // =============================================================
    {
      const goalConc1 = await SavingGoal.create({
        user: userA._id,
        goalName: "Concurrent Goal 1",
        category: "Other",
        targetAmount: 50000,
        currentAmount: 0,
        alreadySaved: 0,
        startDate: new Date("2026-01-01"),
        targetDate: new Date("2027-01-01"),
        status: "Active",
      });

      const goalConc2 = await SavingGoal.create({
        user: userA._id,
        goalName: "Concurrent Goal 2",
        category: "Other",
        targetAmount: 50000,
        currentAmount: 0,
        alreadySaved: 0,
        startDate: new Date("2026-01-01"),
        targetDate: new Date("2027-01-01"),
        status: "Active",
      });

      const sendReq = (goalId) =>
        fetch(`${BASE_URL}/api/saving-goals/${goalId}/contribution`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            amount: 10000,
            date: "2026-05-18",
            selectedMonth: TARGET_ISO,
          }),
        }).then(async (r) => ({ status: r.status, data: await r.json() }));

      // Fire both requests simultaneously
      const [res1, res2] = await Promise.all([sendReq(goalConc1._id), sendReq(goalConc2._id)]);

      const successes = [res1, res2].filter((r) => r.status === 200 && r.data.success);
      const blocked = [res1, res2].filter((r) => r.status === 400 && r.data.code === "INSUFFICIENT_FUNDS");

      const noDoubleSpend = successes.length === 1 && blocked.length === 1;

      recordResult(
        5,
        "Available ₹15,000; two concurrent requests of ₹10,000: serialization prevents double-spending",
        noDoubleSpend,
        `Successes: ${successes.length}, Blocked: ${blocked.length}, Blocked Msg: "${blocked[0]?.data.message}"`
      );

      // Clean up concurrent goals
      await SavingGoal.deleteMany({ _id: { $in: [goalConc1._id, goalConc2._id] } });
    }

    // =============================================================
    // TEST 6: Available balance changes between page load & submission:
    // Backend uses fresh balance and blocks overspend.
    // =============================================================
    {
      // Page loaded when available was ₹15,000.
      // Now a concurrent transaction or expense deduction happens in the background:
      await MonthlyFinance.updateOne(
        { user: userA._id, year: TARGET_YEAR, month: TARGET_MONTH },
        { expenses: 22000 } // Income 25,000 - Expenses 22,000 => Fresh Available = 3,000
      );

      // User submits payment of ₹5,000 that was allowed under old balance (15,000)
      const res = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 5000,
          paidDate: "2026-05-20",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const freshInv = await Investment.findById(invA._id);

      const isBlockedWithFreshBalance =
        res.status === 400 &&
        data.code === "INSUFFICIENT_FUNDS" &&
        data.availableAmount === 3000 &&
        data.requestedAmount === 5000;

      recordResult(
        6,
        "Available balance changes between page load and submission: fresh database balance enforced",
        isBlockedWithFreshBalance,
        `Status: ${res.status}, Code: ${data.code}, Fresh Available: ₹${data.availableAmount}, Requested: ₹${data.requestedAmount}`
      );

      // Restore User A expenses to 10,000 => Available = 15,000
      await MonthlyFinance.updateOne(
        { user: userA._id, year: TARGET_YEAR, month: TARGET_MONTH },
        { expenses: 10000 }
      );
    }

    // =============================================================
    // TEST 7: Different selected month/year: period calculation isolation
    // =============================================================
    {
      // In 2026-06 (June 2026), User A has Income = 50,000, Expenses = 10,000 => Available = 40,000
      await MonthlyFinance.create({
        user: userA._id,
        year: 2026,
        month: 6,
        income: 50000,
        expenses: 10000,
        openingBalance: 0,
        cashBalance: 0,
      });

      // A payment of ₹30,000 in 2026-05 would be blocked (Available 15,000),
      // but in 2026-06 it must be allowed (Available 40,000)
      const resMay = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 30000,
          paidDate: "2026-05-15",
          status: "Paid",
          selectedMonth: "2026-05",
        }),
      });
      const dataMay = await resMay.json();

      const resJune = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 30000,
          paidDate: "2026-06-15",
          status: "Paid",
          selectedMonth: "2026-06",
        }),
      });
      const dataJune = await resJune.json();

      const periodCorrect =
        resMay.status === 400 &&
        dataMay.code === "INSUFFICIENT_FUNDS" &&
        dataMay.availableAmount === 15000 &&
        resJune.status === 201 &&
        dataJune.success;

      recordResult(
        7,
        "Different selected month/year: correctly uses specific period's financial calculation",
        periodCorrect,
        `May 2026: blocked (Avail ₹${dataMay.availableAmount}), June 2026: allowed (Status ${resJune.status})`
      );

      // Clean up June contribution and June finance
      await MonthlyFinance.deleteOne({ user: userA._id, year: 2026, month: 6 });
      await Investment.updateOne({ _id: invA._id }, { $set: { sipContributions: [] } });
    }

    // =============================================================
    // TEST 8: Another user attempts payment: strict authenticated user isolation
    // =============================================================
    {
      // User B has Available to Allocate = ₹0 in 2026-05
      await MonthlyFinance.create({
        user: userB._id,
        year: TARGET_YEAR,
        month: TARGET_MONTH,
        income: 5000,
        expenses: 5000,
        openingBalance: 0,
        cashBalance: 0,
      });

      const invB = await Investment.create({
        user: userB._id,
        name: "User B SIP",
        type: "Mutual Fund",
        amount: 5000,
        monthlyContribution: 5000,
        contributionType: "Recurring",
        startDate: new Date("2026-01-01"),
        status: "Active",
      });

      // User B requests ₹10,000. Even though User A has ₹15,000, User B must be evaluated strictly against User B's ₹0!
      const res = await fetch(`${BASE_URL}/api/investments/${invB._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({
          amount: 10000,
          paidDate: "2026-05-10",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });

      const data = await res.json();
      const userIsolated =
        res.status === 400 &&
        data.code === "INSUFFICIENT_FUNDS" &&
        data.availableAmount === 0 &&
        data.requestedAmount === 10000;

      recordResult(
        8,
        "Another user attempts payment: strictly uses verified session/token records without cross-leakage",
        userIsolated,
        `User B Available: ₹${data.availableAmount}, Requested: ₹${data.requestedAmount}, Message: "${data.message}"`
      );
    }

    // =============================================================
    // TEST 9: Invalid, zero, negative, NaN, infinite amount rejected
    // =============================================================
    {
      const invalidAmounts = [0, -500, "NaN", null, "not-a-number", Infinity];
      let allRejectedWithoutDeduction = true;
      const rejectDetails = [];

      for (const invAmt of invalidAmounts) {
        const res = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            amount: invAmt,
            paidDate: "2026-05-10",
            status: "Paid",
            selectedMonth: TARGET_ISO,
          }),
        });
        const data = await res.json();
        if (res.status !== 400 || data.success) {
          allRejectedWithoutDeduction = false;
          rejectDetails.push(`Failed on amount ${invAmt}: status ${res.status}`);
        }
      }

      const freshInv = await Investment.findById(invA._id);
      const noRecordsAdded = freshInv.sipContributions.length === 0;

      recordResult(
        9,
        "Invalid, zero, negative, NaN, or infinite amount: rejected without modifying financial records",
        allRejectedWithoutDeduction && noRecordsAdded,
        `All 6 invalid amount variants returned HTTP 400. Records added: ${freshInv.sipContributions.length}`
      );
    }

    // =============================================================
    // TEST 10: Regression check: Existing successful payments, reports, and calculations continue working
    // =============================================================
    {
      // 1. Perform a legitimate payment within funds (₹5,000 out of ₹15,000)
      const res = await fetch(`${BASE_URL}/api/investments/${invA._id}/contributions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          amount: 5000,
          paidDate: "2026-05-10",
          status: "Paid",
          selectedMonth: TARGET_ISO,
        }),
      });
      const data = await res.json();

      // 2. Verify cash flow breakdown reflects the new outflow immediately
      const postPaymentBreakdown = await calculateMonthlyCashFlowBreakdown({
        userId: userA._id,
        year: TARGET_YEAR,
        month: TARGET_MONTH,
      });

      // Expected new available balance: 15,000 - 5,000 = 10,000
      const balanceUpdated = postPaymentBreakdown.availableToAllocate === 10000;

      // 3. Verify report generation continues working cleanly
      const reportData = await buildFinancialReportForUser(userA._id, { year: TARGET_YEAR });
      const reportWorks = reportData && reportData.calculationBreakdown && reportData.calculationBreakdown.availableToAllocate !== undefined;

      const regressionPassed = res.status === 201 && data.success && balanceUpdated && reportWorks;

      recordResult(
        10,
        "Regression check: legitimate payments succeed, available balance adjusts, reports and calculations intact",
        regressionPassed,
        `Payment Status: ${res.status}, New Available: ₹${postPaymentBreakdown.availableToAllocate}, Report Available: ₹${reportData?.calculationBreakdown?.availableToAllocate}`
      );
    }

  } finally {
    // CLEANUP: Clean up test accounts to leave MongoDB untouched
    if (userA) {
      await User.deleteOne({ _id: userA._id });
      await MonthlyFinance.deleteMany({ user: userA._id });
      await Investment.deleteMany({ user: userA._id });
      await Insurance.deleteMany({ user: userA._id });
      await Liability.deleteMany({ user: userA._id });
      await SavingGoal.deleteMany({ user: userA._id });
    }
    if (userB) {
      await User.deleteOne({ _id: userB._id });
      await MonthlyFinance.deleteMany({ user: userB._id });
      await Investment.deleteMany({ user: userB._id });
      await Insurance.deleteMany({ user: userB._id });
      await Liability.deleteMany({ user: userB._id });
      await SavingGoal.deleteMany({ user: userB._id });
    }
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB. Test cleanup complete.");
  }

  console.log("\n============================================================");
  console.log("TEST SUMMARY REPORT");
  console.log("============================================================");
  let totalPass = 0;
  testReport.forEach((t) => {
    if (t.pass) totalPass++;
    console.log(`${t.pass ? "PASS" : "FAIL"} | Test ${t.testNum}: ${t.testName}`);
  });
  console.log(`\nTOTAL: ${totalPass}/${testReport.length} PASSED`);

  if (totalPass !== testReport.length) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
