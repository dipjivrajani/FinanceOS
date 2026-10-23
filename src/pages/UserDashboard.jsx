// ============================================================
// FINANCEOS - USER DASHBOARD
// ============================================================
//
// Features:
// 1. Month-Specific Dashboard with URL / View-State persistence (?month=YYYY-MM)
// 2. Default to current month on fresh login & persistent across F5 refresh
// 3. Interactive Month Selector + OK button
// 4. Live Monthly Contribution & Commitment Status Box:
//    - Real-time aggregation of Goals, SIPs/RDs, Insurance, and Liabilities
//    - Completed vs. Remaining vs. Overdue vs. Upcoming distinction
//    - Actual payment/contribution is the source of completed
//    - Progress bar: (Completed / Expected) * 100
//    - Live action buttons to pay/contribute without page refresh
// 5. Dynamic Month-Specific calculations (Income, Expenses, Savings, Opening, Closing, Available to Allocate)
// 6. Carry-forward balance integration
// 7. Empty state handling
//
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

// ============================================================
// IMPORT ICONS
// ============================================================

import {
  FiDollarSign,
  FiTrendingDown,
  FiSave,
  FiPieChart,
  FiMessageSquare,
  FiCheckCircle,
  FiAlertCircle,
  FiCalendar,
  FiChevronDown,
  FiX,
  FiArrowRight,
  FiClock,
  FiTarget,
  FiTrendingUp,
  FiShield,
  FiCreditCard,
  FiCheck,
  FiPlus,
  FiAlertTriangle,
  FiList,
} from "react-icons/fi";

// ============================================================
// IMPORT LAYOUT
// ============================================================

import Sidebar from "../components/layout/Sidebar.jsx";
import Topbar from "../components/layout/Topbar.jsx";

// ============================================================
// IMPORT DASHBOARD COMPONENTS
// ============================================================

import FinancialSummaryCard from "../components/dashboard/FinancialSummaryCard.jsx";
import FinancialHealthScore from "../components/dashboard/FinancialHealthScore.jsx";
import NetWorthChart from "../components/dashboard/NetWorthChart.jsx";
import ActiveFinancialItems from "../components/dashboard/ActiveFinancialItems.jsx";
import CalculationBreakdownModal from "../components/monthlyFinance/CalculationBreakdownModal.jsx";
import UpcomingFinancialActivity from "../components/dashboard/UpcomingFinancialActivity.jsx";
import FinancialSuggestions from "../components/dashboard/FinancialSuggestions.jsx";
import SIPContributionModal from "../components/plansCommitments/SIPContributionModal.jsx";

// ============================================================
// IMPORT FINANCE CONTEXT & UTILS
// ============================================================

import useFinance from "../context/useFinance.js";
import {
  calculateMonthlySavings,
  calculateMonthlyShortfall,
} from "../utils/financialCalculations.js";
import { isItemActiveInMonth } from "../utils/monthLifecycle.js";
import { calculateDueDateForMonth, formatDateISO, isDueInMonth } from "../utils/dueDateSchedule.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function UserDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ==========================================================
  // REAL-WORLD CURRENT PERIOD
  // ==========================================================
  const currentDate = new Date();
  const realCurrentYear = currentDate.getFullYear();
  const realCurrentMonth = currentDate.getMonth() + 1;
  const realCurrentDay = currentDate.getDate();

  // ==========================================================
  // ==========================================================
  // FINANCE CONTEXT
  // ==========================================================
  const {
    userData,
    monthlyFinance,
    loadMonthFinance,
    selectedMonth,
    setSelectedMonth,
    openingBalance = 0,
    closingBalance = 0,
    goalMonthlyCommitment = 0,
    savingGoals,
    liabilities,
    investments,
    insurancePolicies,
    activeLiabilities,
    userReminders,
    availableToAllocate,
    cashFlowBreakdown,
    notifications,
    markNotificationAsRead,
    addGoalContribution,
    addInsurancePayment,
    recordLiabilityPayment,
    sidebarCollapsed,
  } = useFinance();

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // ==========================================================
  // PARSE SELECTED MONTH FROM URL (?month=YYYY-MM) OR CONTEXT
  // ==========================================================
  const monthParam = searchParams.get("month");

  const parsedPeriod = useMemo(() => {
    // 1. Check URL param first
    if (monthParam && /^\d{4}-\d{1,2}$/.test(monthParam)) {
      const [yStr, mStr] = monthParam.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
        return {
          year: y,
          month: m,
          isCustom: y !== realCurrentYear || m !== realCurrentMonth,
          formatted: `${MONTH_NAMES[m - 1]} ${y}`,
          iso: `${y}-${String(m).padStart(2, "0")}`,
        };
      }
    }

    // 2. Check context / sessionStorage next
    const savedMonth = selectedMonth || (typeof window !== "undefined" ? sessionStorage.getItem("financeos_selected_month") : "");
    if (savedMonth && /^\d{4}-\d{1,2}$/.test(savedMonth)) {
      const [yStr, mStr] = savedMonth.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
        return {
          year: y,
          month: m,
          isCustom: y !== realCurrentYear || m !== realCurrentMonth,
          formatted: `${MONTH_NAMES[m - 1]} ${y}`,
          iso: `${y}-${String(m).padStart(2, "0")}`,
        };
      }
    }

    // 3. Default to real-world current month
    return {
      year: realCurrentYear,
      month: realCurrentMonth,
      isCustom: false,
      formatted: `${MONTH_NAMES[realCurrentMonth - 1]} ${realCurrentYear}`,
      iso: `${realCurrentYear}-${String(realCurrentMonth).padStart(2, "0")}`,
    };
  }, [monthParam, selectedMonth, realCurrentYear, realCurrentMonth]);

  // Keep URL in sync with parsedPeriod if it's a custom month
  useEffect(() => {
    if (parsedPeriod.isCustom && monthParam !== parsedPeriod.iso) {
      setSearchParams({ month: parsedPeriod.iso }, { replace: true });
    }
  }, [parsedPeriod.isCustom, parsedPeriod.iso, monthParam, setSearchParams]);

  // Load selected month's data whenever the period changes
  useEffect(() => {
    loadMonthFinance(parsedPeriod.year, parsedPeriod.month);
  }, [parsedPeriod.year, parsedPeriod.month, loadMonthFinance]);

  // ==========================================================
  // MONTH SELECTOR MODAL STATE
  // ==========================================================
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [pickerYear, setPickerYear] = useState(parsedPeriod.year);
  const [pickerMonth, setPickerMonth] = useState(parsedPeriod.month);

  useEffect(() => {
    setPickerYear(parsedPeriod.year);
    setPickerMonth(parsedPeriod.month);
  }, [parsedPeriod.year, parsedPeriod.month, showMonthModal]);

  const handleApplyMonth = (e) => {
    if (e) e.preventDefault();
    const monthStr = `${pickerYear}-${String(pickerMonth).padStart(2, "0")}`;
    setSelectedMonth(monthStr);
    setSearchParams({ month: monthStr });
    loadMonthFinance(pickerYear, pickerMonth);
    setShowMonthModal(false);
  };

  const handleResetToCurrent = () => {
    setSelectedMonth("");
    try {
      sessionStorage.removeItem("financeos_selected_month");
    } catch (e) {}
    setSearchParams({});
    loadMonthFinance(realCurrentYear, realCurrentMonth);
    setShowMonthModal(false);
  };

  const availableYears = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1, y - 2, y - 3];
  }, []);

  const unreadAdminMessages = useMemo(() => {
    return (notifications || []).filter(
      (n) => (n.notificationType === "admin" || n.source === "FinanceOS Admin" || n.source === "admin") && !n.read
    );
  }, [notifications]);

  // Safe Arrays
  const goals = Array.isArray(savingGoals) ? savingGoals : [];
  const liabilityRecords = Array.isArray(liabilities) ? liabilities : [];
  const investmentRecords = Array.isArray(investments) ? investments : [];
  const insuranceRecords = Array.isArray(insurancePolicies) ? insurancePolicies : [];

  // ==========================================================
  // DYNAMIC MONTH COMMITMENT / CONTRIBUTION AGGREGATION
  // ==========================================================
  // DYNAMIC MONTH COMMITMENT / CONTRIBUTION AGGREGATION
  // Automatically derives due dates from stored recurring schedules (dueDay + frequency)
  // for the active working month.
  // ==========================================================
  const commitmentData = useMemo(() => {
    const targetYear = parsedPeriod.year;
    const targetMonth = parsedPeriod.month;
    const isSelectedCurrent = targetYear === realCurrentYear && targetMonth === realCurrentMonth;
    const isSelectedPast = targetYear < realCurrentYear || (targetYear === realCurrentYear && targetMonth < realCurrentMonth);

    const items = [];

    // 1. SAVING GOALS
    goals.forEach((goal) => {
      if (!isItemActiveInMonth(goal, targetYear, targetMonth)) return;
      if (goal.status === "Closed" || goal.status === "Settled") return;

      const freq = goal.contributionFrequency || "Monthly";
      if (!isDueInMonth(freq, goal.startDate, targetYear, targetMonth)) return;

      const expected = Number(goal.monthlyContribution || 0);

      // Contributions in target month
      const contribsInMonth = (goal.contributions || []).filter((c) => {
        const cDate = new Date(c.date || c.createdAt);
        return !Number.isNaN(cDate.getTime()) && cDate.getFullYear() === targetYear && cDate.getMonth() + 1 === targetMonth;
      });

      const paid = contribsInMonth.reduce((acc, c) => acc + Number(c.amount || 0), 0);
      const remaining = Math.max(0, expected - paid);

      if (expected <= 0 && paid <= 0) return;

      // Stored due day
      const goalDay = goal.contributionDay
        || (goal.reminder && goal.reminder.contributionDay)
        || (goal.targetDate ? new Date(goal.targetDate).getDate() : 15);
      const goalDueDateObj = calculateDueDateForMonth(goalDay, targetYear, targetMonth);
      const goalDueDateISO = formatDateISO(goalDueDateObj);

      let status = "Not Paid";
      if (paid >= expected && expected > 0) {
        status = "Paid";
      } else if (paid > 0 && paid < expected) {
        status = "Partially Paid";
      } else if (paid > 0 && expected === 0) {
        status = "Paid";
      } else {
        if (isSelectedPast) {
          status = "Not Paid";
        } else if (isSelectedCurrent) {
          const dueDayNum = goalDueDateObj.getDate();
          status = realCurrentDay > dueDayNum ? "Overdue" : (realCurrentDay === dueDayNum ? "Due" : "Upcoming");
        } else {
          status = "Upcoming";
        }
      }

      items.push({
        id: `goal-${goal._id || goal.id}`,
        type: "Saving Goal",
        subType: goal.category || "Saving Goal",
        name: goal.goalName || goal.name || "Saving Goal",
        expected,
        paid,
        remaining,
        status,
        dueDate: goalDueDateISO,
        rawItem: goal,
        actionType: "goal",
      });
    });

    // 2. INVESTMENTS (SIP / RD / Recurring)
    investmentRecords.forEach((inv) => {
      if (!isItemActiveInMonth(inv, targetYear, targetMonth)) return;
      if (inv.status === "Closed" || inv.status === "Matured") return;
      const isRecurring = inv.type === "SIP" || inv.type === "Recurring Deposit" || inv.contributionType === "Recurring";
      if (!isRecurring) return;

      // Frequency check: don't generate contributions for months where recurring schedule doesn't hit
      if (!isDueInMonth(inv.frequency || "Monthly", inv.startDate, targetYear, targetMonth)) return;

      const expected = Number(inv.monthlyContribution || inv.amount || 0);

      const contribs = (inv.sipContributions || []).filter((c) => {
        const dateToCheck = c.dueDate ? new Date(c.dueDate) : c.paidDate ? new Date(c.paidDate) : null;
        if (!dateToCheck || Number.isNaN(dateToCheck.getTime())) return false;
        return dateToCheck.getFullYear() === targetYear && dateToCheck.getMonth() + 1 === targetMonth;
      });

      let paid = 0;
      let hasPaidEntry = false;
      let hasSkippedEntry = false;

      contribs.forEach((c) => {
        if (c.status === "Paid") {
          paid += Number(c.amount || 0);
          hasPaidEntry = true;
        } else if (c.status === "Skipped") {
          hasSkippedEntry = true;
        }
      });

      if (expected <= 0 && paid <= 0) return;

      const remaining = hasPaidEntry || hasSkippedEntry ? Math.max(0, expected - paid) : expected;

      // Derive due date for target month from stored dueDay
      const invDay = inv.dueDay
        || (inv.reminder && inv.reminder.contributionDay)
        || (inv.nextContributionDate ? new Date(inv.nextContributionDate).getDate() : 10);
      const invDueDateObj = calculateDueDateForMonth(invDay, targetYear, targetMonth);
      const invDueDateISO = formatDateISO(invDueDateObj);

      let status = "Not Paid";
      if (hasSkippedEntry) {
        status = "Skipped";
      } else if (paid >= expected && expected > 0) {
        status = "Paid";
      } else if (paid > 0 && paid < expected) {
        status = "Partially Paid";
      } else if (paid > 0 && expected === 0) {
        status = "Paid";
      } else {
        if (isSelectedPast) {
          status = "Not Paid";
        } else if (isSelectedCurrent) {
          const dueDayNum = invDueDateObj.getDate();
          status = realCurrentDay > dueDayNum ? "Overdue" : (realCurrentDay === dueDayNum ? "Due" : "Upcoming");
        } else {
          status = "Upcoming";
        }
      }

      items.push({
        id: `inv-${inv._id || inv.id}`,
        type: "Investment",
        subType: inv.type || "SIP",
        name: inv.name || "Investment SIP",
        expected,
        paid,
        remaining,
        status,
        dueDate: invDueDateISO,
        rawItem: inv,
        actionType: "investment",
      });
    });

    // 3. INSURANCE POLICIES
    insuranceRecords.forEach((policy) => {
      if (!isItemActiveInMonth(policy, targetYear, targetMonth)) return;
      if (policy.status === "Closed" || policy.status === "Expired" || policy.status === "Cancelled" || policy.status === "Lapsed") return;

      const freq = String(policy.premiumFrequency || "Monthly").trim();
      if (freq !== "One Time" && !isDueInMonth(freq, policy.startDate, targetYear, targetMonth)) return;

      let expected = 0;
      const prem = Number(policy.premiumAmount || policy.monthlyPremium || 0);

      if (freq.includes("month")) {
        expected = prem;
      } else if (freq.includes("quarter")) {
        expected = prem / 3;
      } else if (freq.includes("half")) {
        expected = prem / 6;
      } else if (freq.includes("year") || freq.includes("annual")) {
        expected = prem / 12;
      } else {
        expected = prem;
      }

      const paymentsInMonth = (policy.payments || []).filter((p) => {
        const pDate = new Date(p.paidDate || p.dueDate || p.date || p.createdAt);
        return !Number.isNaN(pDate.getTime()) && pDate.getFullYear() === targetYear && pDate.getMonth() + 1 === targetMonth;
      });

      const paid = paymentsInMonth.reduce((acc, p) => acc + (p.status === "Paid" ? Number(p.amount || 0) : 0), 0);
      const remaining = Math.max(0, expected - paid);

      if (expected <= 0 && paid <= 0) return;

      // Derive due date for target month from stored premiumDueDay
      const insDay = policy.premiumDueDay
        || (policy.startDate ? new Date(policy.startDate).getDate() : 1);
      const insDueDateObj = calculateDueDateForMonth(insDay, targetYear, targetMonth);
      const insDueDateISO = formatDateISO(insDueDateObj);

      let status = "Not Paid";
      if (paid >= expected && expected > 0) {
        status = "Paid";
      } else if (paid > 0 && paid < expected) {
        status = "Partially Paid";
      } else if (paid > 0 && expected === 0) {
        status = "Paid";
      } else {
        if (isSelectedPast) {
          status = "Not Paid";
        } else if (isSelectedCurrent) {
          const dueDayNum = insDueDateObj.getDate();
          status = realCurrentDay > dueDayNum ? "Overdue" : (realCurrentDay === dueDayNum ? "Due" : "Upcoming");
        } else {
          status = "Upcoming";
        }
      }

      items.push({
        id: `ins-${policy._id || policy.id}`,
        type: "Insurance",
        subType: policy.type || "Insurance Policy",
        name: policy.name || "Insurance Premium",
        expected,
        paid,
        remaining,
        status,
        dueDate: insDueDateISO,
        rawItem: policy,
        actionType: "insurance",
      });
    });

    // 4. LIABILITIES (Loans & EMIs)
    liabilityRecords.forEach((liability) => {
      if (!isItemActiveInMonth(liability, targetYear, targetMonth)) return;
      if (liability.status === "Closed" || liability.status === "Completed" || liability.status === "Paid" || liability.status === "Settled") return;

      const freq = String(liability.paymentFrequency || "Monthly").trim();
      if (!isDueInMonth(freq, liability.startDate, targetYear, targetMonth)) return;

      const expected = Number(liability.monthlyPayment || liability.monthlyEMI || liability.emi || 0);

      const paymentsInMonth = (liability.payments || []).filter((p) => {
        const pDate = new Date(p.paidDate || p.dueDate || p.date || p.createdAt);
        return !Number.isNaN(pDate.getTime()) && pDate.getFullYear() === targetYear && pDate.getMonth() + 1 === targetMonth;
      });

      const paid = paymentsInMonth.reduce((acc, p) => acc + (p.status === "Paid" ? Number(p.amount || 0) : 0), 0);
      const remaining = Math.max(0, expected - paid);

      if (expected <= 0 && paid <= 0) return;

      // Derive due date for target month from stored dueDay
      const liabDay = liability.dueDay
        || (liability.nextDueDate ? new Date(liability.nextDueDate).getDate() : 5);
      const liabDueDateObj = calculateDueDateForMonth(liabDay, targetYear, targetMonth);
      const liabDueDateISO = formatDateISO(liabDueDateObj);

      let status = "Not Paid";
      if (paid >= expected && expected > 0) {
        status = "Paid";
      } else if (paid > 0 && paid < expected) {
        status = "Partially Paid";
      } else if (paid > 0 && expected === 0) {
        status = "Paid";
      } else {
        if (isSelectedPast) {
          status = "Not Paid";
        } else if (isSelectedCurrent) {
          const dueDayNum = liabDueDateObj.getDate();
          status = realCurrentDay > dueDayNum ? "Overdue" : (realCurrentDay === dueDayNum ? "Due" : "Upcoming");
        } else {
          status = "Upcoming";
        }
      }

      items.push({
        id: `liab-${liability._id || liability.id}`,
        type: "Liability",
        subType: liability.type || "Loan EMI",
        name: liability.name || "Loan EMI",
        expected,
        paid,
        remaining,
        status,
        dueDate: liabDueDateISO,
        rawItem: liability,
        actionType: "liability",
      });
    });

    const totalExpected = items.reduce((acc, it) => acc + it.expected, 0);
    const totalCompleted = items.reduce((acc, it) => acc + it.paid, 0);
    const totalRemaining = items.reduce((acc, it) => acc + it.remaining, 0);
    const totalOverdue = items.filter((it) => it.status === "Overdue").reduce((acc, it) => acc + it.remaining, 0);
    const totalUpcoming = items.filter((it) => it.status === "Upcoming" || it.status === "Due").reduce((acc, it) => acc + it.remaining, 0);

    const progressPercentage = totalExpected > 0
      ? Math.min(100, Math.round((totalCompleted / totalExpected) * 100))
      : (totalCompleted > 0 ? 100 : 0);

    return {
      items,
      totalExpected,
      totalCompleted,
      totalRemaining,
      totalOverdue,
      totalUpcoming,
      progressPercentage,
    };
  }, [goals, investmentRecords, insuranceRecords, liabilityRecords, parsedPeriod.year, parsedPeriod.month, realCurrentYear, realCurrentMonth, realCurrentDay]);

  // Tab filter for item-level commitment status
  const [activeCommitmentTab, setActiveCommitmentTab] = useState("all");

  const filteredCommitmentItems = useMemo(() => {
    if (activeCommitmentTab === "completed") {
      return commitmentData.items.filter((it) => it.status === "Paid");
    }
    if (activeCommitmentTab === "remaining") {
      return commitmentData.items.filter((it) => it.remaining > 0);
    }
    if (activeCommitmentTab === "overdue") {
      return commitmentData.items.filter((it) => it.status === "Overdue");
    }
    if (activeCommitmentTab === "upcoming") {
      return commitmentData.items.filter((it) => it.status === "Upcoming");
    }
    return commitmentData.items;
  }, [commitmentData.items, activeCommitmentTab]);

  // Action Modals State
  const [selectedSIPInvestment, setSelectedSIPInvestment] = useState(null);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState(null);
  const [selectedInsuranceForPayment, setSelectedInsuranceForPayment] = useState(null);
  const [selectedLiabilityForPayment, setSelectedLiabilityForPayment] = useState(null);

  // Quick Goal Contribution Form State
  const [quickGoalAmount, setQuickGoalAmount] = useState("");
  const [quickGoalDate, setQuickGoalDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickGoalNote, setQuickGoalNote] = useState("");
  const [quickGoalSubmitting, setQuickGoalSubmitting] = useState(false);

  // Quick Insurance Payment State
  const [quickInsAmount, setQuickInsAmount] = useState("");
  const [quickInsDate, setQuickInsDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickInsNote, setQuickInsNote] = useState("");
  const [quickInsSubmitting, setQuickInsSubmitting] = useState(false);

  // Quick Liability Payment State
  const [quickLiabAmount, setQuickLiabAmount] = useState("");
  const [quickLiabDate, setQuickLiabDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickLiabNote, setQuickLiabNote] = useState("");
  const [quickLiabSubmitting, setQuickLiabSubmitting] = useState(false);

  // Handlers for quick actions
  const handleOpenActionModal = (item) => {
    if (item.actionType === "investment") {
      setSelectedSIPInvestment(item.rawItem);
    } else if (item.actionType === "goal") {
      setSelectedGoalForContribution(item.rawItem);
      setQuickGoalAmount(String(item.remaining > 0 ? item.remaining : item.expected || ""));
      setQuickGoalDate(new Date().toISOString().slice(0, 10));
      setQuickGoalNote("");
    } else if (item.actionType === "insurance") {
      setSelectedInsuranceForPayment(item.rawItem);
      setQuickInsAmount(String(item.remaining > 0 ? item.remaining : item.expected || ""));
      setQuickInsDate(new Date().toISOString().slice(0, 10));
      setQuickInsNote("");
    } else if (item.actionType === "liability") {
      setSelectedLiabilityForPayment(item.rawItem);
      setQuickLiabAmount(String(item.remaining > 0 ? item.remaining : item.expected || ""));
      setQuickLiabDate(new Date().toISOString().slice(0, 10));
      setQuickLiabNote("");
    }
  };

  const handleQuickGoalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGoalForContribution || !quickGoalAmount || Number(quickGoalAmount) <= 0) return;
    setQuickGoalSubmitting(true);
    try {
      await addGoalContribution(selectedGoalForContribution.id || selectedGoalForContribution._id, {
        amount: Number(quickGoalAmount),
        date: quickGoalDate,
        source: "Monthly Savings",
        note: quickGoalNote.trim(),
      });
      await loadMonthFinance(parsedPeriod.year, parsedPeriod.month);
      setSelectedGoalForContribution(null);
    } catch (err) {
      if (err?.code === "INSUFFICIENT_FUNDS") {
        setSelectedGoalForContribution(null);
      }
      console.error("Goal contribution error:", err);
    } finally {
      setQuickGoalSubmitting(false);
    }
  };

  const handleQuickInsuranceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInsuranceForPayment || !quickInsAmount || Number(quickInsAmount) <= 0) return;
    setQuickInsSubmitting(true);
    try {
      await addInsurancePayment(selectedInsuranceForPayment.id || selectedInsuranceForPayment._id, {
        amount: Number(quickInsAmount),
        paidDate: quickInsDate,
        date: quickInsDate,
        status: "Paid",
        note: quickInsNote.trim(),
      });
      await loadMonthFinance(parsedPeriod.year, parsedPeriod.month);
      setSelectedInsuranceForPayment(null);
    } catch (err) {
      if (err?.code === "INSUFFICIENT_FUNDS") {
        setSelectedInsuranceForPayment(null);
      }
      console.error("Insurance payment error:", err);
    } finally {
      setQuickInsSubmitting(false);
    }
  };

  const handleQuickLiabilitySubmit = async (e) => {
    e.preventDefault();
    if (!selectedLiabilityForPayment || !quickLiabAmount || Number(quickLiabAmount) <= 0) return;
    setQuickLiabSubmitting(true);
    try {
      await recordLiabilityPayment(selectedLiabilityForPayment.id || selectedLiabilityForPayment._id, {
        amount: Number(quickLiabAmount),
        paidDate: quickLiabDate,
        date: quickLiabDate,
        status: "Paid",
        note: quickLiabNote.trim(),
      });
      await loadMonthFinance(parsedPeriod.year, parsedPeriod.month);
      setSelectedLiabilityForPayment(null);
    } catch (err) {
      if (err?.code === "INSUFFICIENT_FUNDS") {
        setSelectedLiabilityForPayment(null);
      }
      console.error("Liability payment error:", err);
    } finally {
      setQuickLiabSubmitting(false);
    }
  };

  // ==========================================================
  // MONTH-SPECIFIC VALUES
  // ==========================================================
  const income = Number(monthlyFinance?.income || 0);
  const expenses = Number(monthlyFinance?.expenses || 0);
  const monthlySavings = calculateMonthlySavings(income, expenses);

  const totalCommitments = commitmentData.totalExpected || (
    Number(goalMonthlyCommitment || 0) +
    liabilityRecords.filter((l) => l.status === "Active").reduce((tot, l) => tot + (Number(l.monthlyPayment || l.monthlyEMI || l.emi || 0) || 0), 0) +
    investmentRecords.filter((inv) => inv.status === "Active").reduce((tot, inv) => tot + (Number(inv.monthlyContribution || inv.amount || 0) || 0), 0) +
    insuranceRecords.filter((ins) => ins.status === "Active").reduce((tot, p) => tot + (Number(p.premiumAmount || p.monthlyPremium || 0) || 0), 0)
  );

  const monthlyShortfall = calculateMonthlyShortfall(availableToAllocate);

  return (
    <div className="min-h-screen bg-[#f6f8f4]">
      <Sidebar />

      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        <Topbar />

        <div className="px-8 py-6">
          {/* ==================================================
              DASHBOARD HEADER & MONTH SELECTOR
             ================================================== */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#315c46]">
                  {parsedPeriod.formatted}
                </p>
                {parsedPeriod.isCustom && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Historical View
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-bold text-[#18392c]">
                Welcome back, {userData?.name || "User"}! 👋
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Financial overview and live monthly commitment status for {parsedPeriod.formatted}.
              </p>
            </div>

            {/* MONTH SELECTOR TRIGGER BUTTON */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowMonthModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-[#cfe0c8] bg-white hover:bg-[#f4f8f2] text-[#24533a] shadow-xs transition-all cursor-pointer"
              >
                <FiCalendar className="text-sm text-[#315c46]" />
                <span>Month: {parsedPeriod.formatted}</span>
                <FiChevronDown className="text-xs text-slate-400" />
              </button>

              {parsedPeriod.isCustom && (
                <button
                  type="button"
                  onClick={handleResetToCurrent}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-[#edf6e8] hover:bg-[#e2f0dc] text-[#315c46] border border-[#cfe5c5] transition-all cursor-pointer"
                  title="Switch to real-world current month"
                >
                  Current Month
                </button>
              )}
            </div>
          </div>

          {/* ==================================================
              HISTORICAL MONTH NOTICE BANNER
             ================================================== */}
          {parsedPeriod.isCustom && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-white p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <FiClock className="text-amber-700 text-lg shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900">
                    Viewing Historical Financial Month ({parsedPeriod.formatted})
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Dashboard cards, commitments, and contributions are filtered for {parsedPeriod.formatted}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetToCurrent}
                className="text-xs font-bold text-amber-900 underline hover:text-amber-950 cursor-pointer"
              >
                Return to {MONTH_NAMES[realCurrentMonth - 1]} {realCurrentYear}
              </button>
            </div>
          )}

          {/* ==================================================
              PERSONALIZED ADMIN COMMUNICATIONS
             ================================================== */}
          {unreadAdminMessages.length > 0 && (
            <div className="mb-6 space-y-3">
              {unreadAdminMessages.slice(0, 3).map((msg) => (
                <div
                  key={msg.id}
                  className={`relative overflow-hidden rounded-2xl border p-5 transition-all shadow-sm ${
                    msg.priority === "Urgent"
                      ? "border-red-200 bg-gradient-to-r from-red-50/80 to-white"
                      : msg.priority === "Important"
                      ? "border-amber-200 bg-gradient-to-r from-amber-50/80 to-white"
                      : "border-[#e0edd8] bg-gradient-to-r from-[#f4f9f0] to-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          msg.priority === "Urgent"
                            ? "bg-red-100 text-red-700"
                            : msg.priority === "Important"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-[#dff2d2] text-[#24533a]"
                        }`}
                      >
                        {msg.priority === "Urgent" ? (
                          <FiAlertCircle size={20} />
                        ) : (
                          <FiMessageSquare size={19} />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#496556]">
                            FinanceOS Notice
                          </span>
                          {msg.category && (
                            <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#18392c] border border-black/5">
                              {msg.category}
                            </span>
                          )}
                          {msg.priority === "Urgent" && (
                            <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              Urgent
                            </span>
                          )}
                          {msg.priority === "Important" && (
                            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              Important
                            </span>
                          )}
                        </div>

                        <h3 className="mt-1 text-sm font-bold text-[#18392c]">
                          {msg.title}
                        </h3>

                        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[#40564b]">
                          {msg.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2 pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => markNotificationAsRead(msg.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#cde0c5] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#25523b] shadow-sm hover:bg-[#f6faf3] cursor-pointer"
                      >
                        <FiCheckCircle size={14} />
                        Mark Read
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ==================================================
              SUMMARY CARDS
             ================================================== */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FinancialSummaryCard
              title="Monthly Income"
              amount={`₹${income.toLocaleString("en-IN")}`}
              description={`Total income recorded for ${parsedPeriod.formatted}`}
              icon={FiDollarSign}
              type="normal"
            />

            <FinancialSummaryCard
              title="Monthly Expenses"
              amount={`₹${expenses.toLocaleString("en-IN")}`}
              description={`Total expenses recorded for ${parsedPeriod.formatted}`}
              icon={FiTrendingDown}
              type="negative"
            />

            <FinancialSummaryCard
              title="Monthly Savings"
              amount={`₹${monthlySavings.toLocaleString("en-IN")}`}
              description="Income remaining after monthly expenses"
              icon={FiSave}
              type={monthlySavings >= 0 ? "positive" : "negative"}
            />

            <FinancialSummaryCard
              title="Available to Allocate"
              amount={`₹${availableToAllocate.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              description={
                totalCommitments > 0
                  ? "Amount remaining after existing commitments"
                  : "Currently available for goals and commitments"
              }
              icon={FiPieChart}
              type={availableToAllocate >= 0 ? "positive" : "negative"}
            />
          </div>

          {/* ==================================================
              MONTHLY FINANCIAL POSITION & COMMITMENT STATUS
             ================================================== */}
          <section className="mt-5 rounded-2xl border border-[#e2e8dc] bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#eef3ea] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#18392c]">
                    Monthly Financial Position & Commitments ({parsedPeriod.formatted})
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  Track live completed contributions, unpaid commitments, and available cash flow for {parsedPeriod.formatted}.
                </p>
              </div>

              {!monthlyFinance?.hasRecord && income === 0 && expenses === 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/monthly-finance")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#315c46] bg-[#f0f6ec] hover:bg-[#e4f0dc] rounded-lg border border-[#d6e7cf] transition-all cursor-pointer"
                >
                  <span>Record {parsedPeriod.formatted} Finance</span>
                  <FiArrowRight />
                </button>
              )}
            </div>

            {/* CORE CASH FLOW TILES */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {/* OPENING BALANCE */}
              <div className="rounded-xl bg-[#f7f9f3] p-4 border border-[#edf3e8] relative group">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-medium">Opening Balance</p>
                  <button
                    onClick={() => setShowBreakdownModal(true)}
                    className="text-[10px] font-bold text-[#315c46] hover:underline cursor-pointer opacity-80 group-hover:opacity-100"
                    title="View opening balance calculation"
                  >
                    Source
                  </button>
                </div>
                <p className="mt-2 text-lg font-bold text-[#18392c]">
                  ₹{formatMoney(openingBalance)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Carried forward into {parsedPeriod.formatted}</p>
              </div>

              {/* INCOME */}
              <div className="rounded-xl bg-[#f7f9f3] p-4 border border-[#edf3e8]">
                <p className="text-xs text-slate-500 font-medium">Income</p>
                <p className="mt-2 text-lg font-bold text-emerald-700">
                  ₹{formatMoney(income)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Monthly total inflow</p>
              </div>

              {/* EXPENSES */}
              <div className="rounded-xl bg-[#f7f9f3] p-4 border border-[#edf3e8]">
                <p className="text-xs text-slate-500 font-medium">Expenses</p>
                <p className="mt-2 text-lg font-bold text-amber-700">
                  ₹{formatMoney(expenses)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Living expenses</p>
              </div>

              {/* MONTHLY SAVINGS */}
              <div className="rounded-xl bg-[#f7f9f3] p-4 border border-[#edf3e8]">
                <p className="text-xs text-slate-500 font-medium">Monthly Savings</p>
                <p className={`mt-2 text-lg font-bold ${monthlySavings >= 0 ? "text-[#315c46]" : "text-red-500"}`}>
                  ₹{formatMoney(monthlySavings)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">Income − Expenses</p>
              </div>

              {/* AVAILABLE TO ALLOCATE */}
              <div className={`rounded-xl p-4 border relative ${availableToAllocate >= 0 ? "bg-[#edf6e8] border-[#cfe5c5]" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold ${availableToAllocate >= 0 ? "text-[#315c46]" : "text-red-600"}`}>
                    Available to Allocate
                  </p>
                  <button
                    onClick={() => setShowBreakdownModal(true)}
                    className="text-[10px] font-bold text-[#315c46] hover:text-[#18392c] hover:underline cursor-pointer bg-white/70 px-1.5 py-0.5 rounded border border-[#d2e4cb]"
                  >
                    View Calc
                  </button>
                </div>
                <p className={`mt-2 text-lg font-bold ${availableToAllocate >= 0 ? "text-[#18392c]" : "text-red-700"}`}>
                  ₹{formatMoney(availableToAllocate)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">Opening + Inflow − Actual Outflows</p>
              </div>
            </div>

            {/* CALCULATION BREAKDOWN MODAL */}
            <CalculationBreakdownModal
              isOpen={showBreakdownModal}
              onClose={() => setShowBreakdownModal(false)}
              breakdown={cashFlowBreakdown}
              monthLabel={parsedPeriod.formatted}
            />

            {/* LIVE COMMITMENT & CONTRIBUTION STATUS BOX */}
            <div className="rounded-2xl border border-[#dce8d6] bg-gradient-to-b from-[#f9fbf8] to-white p-5 space-y-5">
              {/* PROGRESS & SUMMARY HEADER */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#2d523e] uppercase tracking-wider">
                      Monthly Commitment & Contribution Status
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e3efe0] text-[#24533a]">
                      {commitmentData.progressPercentage}% Completed
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Real-time status of SIPs, RD, Insurance, Loan EMIs, and Goal allocations for {parsedPeriod.formatted}.
                  </p>
                </div>

                {/* STATUS BADGES */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                    <FiCheckCircle className="text-emerald-600" />
                    <span>Completed: ₹{formatMoney(commitmentData.totalCompleted)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                    <FiClock className="text-amber-600" />
                    <span>Remaining: ₹{formatMoney(commitmentData.totalRemaining)}</span>
                  </div>

                  {commitmentData.totalOverdue > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold animate-pulse">
                      <FiAlertTriangle className="text-red-600" />
                      <span>Overdue: ₹{formatMoney(commitmentData.totalOverdue)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PROGRESS BAR */}
              {commitmentData.totalExpected > 0 && (
                <div className="space-y-1.5">
                  <div className="h-3 w-full rounded-full bg-[#e7eee4] overflow-hidden flex">
                    <div
                      style={{ width: `${commitmentData.progressPercentage}%` }}
                      className="h-full bg-gradient-to-r from-[#315c46] to-[#477a5e] rounded-full transition-all duration-500"
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>Paid: ₹{formatMoney(commitmentData.totalCompleted)}</span>
                    <span>Expected: ₹{formatMoney(commitmentData.totalExpected)}</span>
                  </div>
                </div>
              )}

              {/* FILTER TABS */}
              {commitmentData.items.length > 0 && (
                <div className="flex items-center gap-2 border-b border-[#e9f0e6] pb-3 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveCommitmentTab("all")}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeCommitmentTab === "all"
                        ? "bg-[#315c46] text-white shadow-xs"
                        : "text-slate-600 hover:bg-[#edf4eb]"
                    }`}
                  >
                    All Items ({commitmentData.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCommitmentTab("remaining")}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeCommitmentTab === "remaining"
                        ? "bg-[#315c46] text-white shadow-xs"
                        : "text-slate-600 hover:bg-[#edf4eb]"
                    }`}
                  >
                    Remaining ({commitmentData.items.filter((it) => it.remaining > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCommitmentTab("completed")}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeCommitmentTab === "completed"
                        ? "bg-[#315c46] text-white shadow-xs"
                        : "text-slate-600 hover:bg-[#edf4eb]"
                    }`}
                  >
                    Completed ({commitmentData.items.filter((it) => it.status === "Paid").length})
                  </button>
                  {commitmentData.totalOverdue > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveCommitmentTab("overdue")}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        activeCommitmentTab === "overdue"
                          ? "bg-red-600 text-white shadow-xs"
                          : "text-red-700 hover:bg-red-50"
                      }`}
                    >
                      Overdue ({commitmentData.items.filter((it) => it.status === "Overdue").length})
                    </button>
                  )}
                </div>
              )}

              {/* ITEM-LEVEL LIST */}
              {commitmentData.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#cfe0c9] bg-[#fbfdfa] p-8 text-center">
                  <FiList className="mx-auto text-3xl text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-[#18392c]">
                    No contributions or commitments for this month.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add saving goals, SIP investments, insurance policies, or loans to track recurring obligations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCommitmentItems.map((item) => {
                    const isPaid = item.status === "Paid";
                    const isOverdue = item.status === "Overdue";
                    const isPartial = item.status === "Partially Paid";

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                          isPaid
                            ? "border-emerald-200 bg-emerald-50/40"
                            : isOverdue
                            ? "border-red-200 bg-red-50/40"
                            : isPartial
                            ? "border-blue-200 bg-blue-50/40"
                            : "border-[#e0edd8] bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {/* CATEGORY ICON */}
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              item.type === "Saving Goal"
                                ? "bg-amber-100 text-amber-800"
                                : item.type === "Investment"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.type === "Insurance"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {item.type === "Saving Goal" && <FiTarget size={18} />}
                            {item.type === "Investment" && <FiTrendingUp size={18} />}
                            {item.type === "Insurance" && <FiShield size={18} />}
                            {item.type === "Liability" && <FiCreditCard size={18} />}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {item.subType}
                              </span>

                              {/* STATUS BADGE */}
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <FiCheck size={10} /> Paid
                                </span>
                              )}
                              {isPartial && (
                                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                  Partially Paid
                                </span>
                              )}
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  <FiAlertTriangle size={10} /> Overdue
                                </span>
                              )}
                              {item.status === "Upcoming" && (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                  Upcoming
                                </span>
                              )}
                              {item.status === "Not Paid" && (
                                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Not Paid
                                </span>
                              )}
                            </div>

                            <h4 className="mt-1 text-sm font-bold text-[#18392c]">
                              {item.name}
                            </h4>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {isPaid
                                ? `Completed in ${parsedPeriod.formatted}`
                                : `Target Due: ${formatDate(item.dueDate)}`}
                            </p>
                          </div>
                        </div>

                        {/* AMOUNTS & ACTION BUTTON */}
                        <div className="flex items-center justify-between sm:justify-end gap-5">
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-500">
                              {isPaid ? "Paid Amount" : "Remaining Amount"}
                            </p>
                            <p
                              className={`text-base font-bold ${
                                isPaid
                                  ? "text-emerald-700"
                                  : isOverdue
                                  ? "text-red-600"
                                  : "text-[#18392c]"
                              }`}
                            >
                              ₹{formatMoney(isPaid ? item.paid : item.remaining)}
                            </p>
                            {item.expected > 0 && !isPaid && item.paid > 0 && (
                              <p className="text-[10px] text-slate-400">
                                Paid: ₹{formatMoney(item.paid)} of ₹{formatMoney(item.expected)}
                              </p>
                            )}
                          </div>

                          {/* ACTION BUTTON */}
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleOpenActionModal(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#315c46] hover:bg-[#224433] rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                            >
                              <FiPlus />
                              <span>
                                {item.actionType === "goal" && "Add Contribution"}
                                {item.actionType === "investment" && "Pay SIP"}
                                {item.actionType === "insurance" && "Pay Premium"}
                                {item.actionType === "liability" && "Pay EMI"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SHORTFALL WARNING */}
            {availableToAllocate < 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-600">
                  Your existing commitments exceed your monthly savings.
                </p>
                <p className="mt-1 text-xs leading-5 text-red-500">
                  Your current monthly shortfall is ₹{formatMoney(monthlyShortfall)}.
                  Review your existing financial commitments before creating another voluntary commitment.
                </p>
              </div>
            )}
          </section>

          {/* ==================================================
              FINANCIAL SUGGESTIONS
             ================================================== */}
          <section className="mt-5">
            <FinancialSuggestions />
          </section>

          {/* ==================================================
              FINANCIAL HEALTH SCORE
             ================================================== */}
          <FinancialHealthScore
            income={income}
            expenses={expenses}
            totalCommitments={totalCommitments}
            availableToAllocate={availableToAllocate}
          />

          {/* ==================================================
              NET WORTH
             ================================================== */}
          <NetWorthChart />

          {/* ==================================================
              ACTIVE FINANCIAL ITEMS
             ================================================== */}
          <ActiveFinancialItems
            savingGoals={goals}
            liabilities={liabilityRecords}
            investments={investmentRecords}
            insurancePolicies={insuranceRecords}
            availableToAllocate={availableToAllocate}
            selectedPeriod={parsedPeriod}
          />

          {/* ==================================================
              UPCOMING FINANCIAL ACTIVITY
             ================================================== */}
          <UpcomingFinancialActivity
            savingGoals={goals}
            investments={investmentRecords}
            insurancePolicies={insuranceRecords}
            liabilities={liabilityRecords}
            userReminders={userReminders}
            selectedMonth={selectedMonth}
          />
        </div>
      </main>

      {/* ======================================================
          INTERACTIVE MONTH SELECTOR MODAL
         ====================================================== */}
      {showMonthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#dfe8dc] overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiCalendar className="text-[#315c46] text-lg" />
                <h3 className="text-base font-bold text-[#18392c]">Select Dashboard Month</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMonthModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Year
              </label>
              <div className="flex items-center gap-2">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setPickerYear(yr)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      pickerYear === yr
                        ? "bg-[#315c46] text-white border-[#315c46] shadow-xs"
                        : "bg-[#f8faf7] text-slate-700 border-[#dce6d8] hover:bg-[#edf5e9]"
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Select Month
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {MONTH_SHORT.map((mShort, idx) => {
                  const mNum = idx + 1;
                  const isSelected = pickerMonth === mNum;
                  const isCurrent = pickerYear === realCurrentYear && mNum === realCurrentMonth;

                  return (
                    <button
                      key={mShort}
                      type="button"
                      onClick={() => setPickerMonth(mNum)}
                      className={`py-2.5 px-2 text-xs font-bold rounded-xl border transition-all relative cursor-pointer ${
                        isSelected
                          ? "bg-[#315c46] text-white border-[#315c46] shadow-xs"
                          : "bg-[#fbfcfb] text-[#18392c] border-[#e2ece0] hover:bg-[#edf6e8]"
                      }`}
                    >
                      <span>{mShort}</span>
                      {isCurrent && !isSelected && (
                        <span className="block text-[8px] font-semibold text-[#315c46]">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f5f9f2] border border-[#d6e7ce] flex items-center justify-between text-xs">
              <span className="text-slate-500">Selected Target:</span>
              <span className="font-bold text-[#18392c]">
                {MONTH_NAMES[pickerMonth - 1]} {pickerYear}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetToCurrent}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-[#18392c] hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Reset to Current
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMonthModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyMonth}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#315c46] hover:bg-[#234533] rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          QUICK ACTION MODALS (SIP, GOAL, INSURANCE, LIABILITY)
         ====================================================== */}
      {/* 1. SIP CONTRIBUTION MODAL */}
      {selectedSIPInvestment && (
        <SIPContributionModal
          investment={selectedSIPInvestment}
          onClose={() => {
            setSelectedSIPInvestment(null);
            loadMonthFinance(parsedPeriod.year, parsedPeriod.month);
          }}
        />
      )}

      {/* 2. QUICK GOAL CONTRIBUTION MODAL */}
      {selectedGoalForContribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#dfe8dc] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#18392c]">Record Goal Contribution</h3>
                <p className="text-xs text-slate-500">{selectedGoalForContribution.goalName || "Saving Goal"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGoalForContribution(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickGoalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contribution Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quickGoalAmount}
                  onChange={(e) => setQuickGoalAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. 5000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Contribution Date
                </label>
                <input
                  type="date"
                  required
                  value={quickGoalDate}
                  onChange={(e) => setQuickGoalDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={quickGoalNote}
                  onChange={(e) => setQuickGoalNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. September monthly allocation"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGoalForContribution(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickGoalSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#315c46] hover:bg-[#224433] rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {quickGoalSubmitting ? "Recording..." : "Save Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. QUICK INSURANCE PAYMENT MODAL */}
      {selectedInsuranceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#dfe8dc] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#18392c]">Record Insurance Premium</h3>
                <p className="text-xs text-slate-500">{selectedInsuranceForPayment.name || "Insurance Policy"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInsuranceForPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickInsuranceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Premium Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quickInsAmount}
                  onChange={(e) => setQuickInsAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. 2000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={quickInsDate}
                  onChange={(e) => setQuickInsDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={quickInsNote}
                  onChange={(e) => setQuickInsNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. Paid online"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInsuranceForPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickInsSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#315c46] hover:bg-[#224433] rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {quickInsSubmitting ? "Recording..." : "Record Premium"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. QUICK LIABILITY PAYMENT MODAL */}
      {selectedLiabilityForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#dfe8dc] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#18392c]">Record Loan EMI / Payment</h3>
                <p className="text-xs text-slate-500">{selectedLiabilityForPayment.name || "Liability"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLiabilityForPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickLiabilitySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quickLiabAmount}
                  onChange={(e) => setQuickLiabAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. 15000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={quickLiabDate}
                  onChange={(e) => setQuickLiabDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={quickLiabNote}
                  onChange={(e) => setQuickLiabNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#cfe0c8] bg-[#fafcf8] focus:border-[#315c46] outline-none"
                  placeholder="e.g. Auto-debit EMI"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLiabilityForPayment(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickLiabSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#315c46] hover:bg-[#224433] rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {quickLiabSubmitting ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;