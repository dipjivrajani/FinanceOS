import { getAuthToken, getAuthUser, clearAuthSession, onAccountDeleted } from "../utils/authStorage.js";
import CenteredModal from "../components/common/CenteredModal.jsx";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import FinanceContext from "./FinanceContext.js";
import { io } from "socket.io-client";
import { isItemActiveInMonth, parseSelectedMonth, isDateInMonth } from "../utils/monthLifecycle.js";
import { deriveCashFlowBreakdown, isDateInPeriod } from "../utils/cashFlowBreakdown.js";

// ============================================================
// DEFAULT MONTHLY FINANCE
// ============================================================

const createDefaultMonthlyFinance = () => ({
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  income: 0,
  expenses: 0,
  updateDate: new Date().toISOString().split('T')[0],
  reminder: {
    enabled: true,
    options: [],
    channels: {
      inApp: true,
      email: true,
    },
  },
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(safeNumber(value), 0);
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function getMonthYearFromDate(dateValue) {
  if (!dateValue) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

function addMonthsToDate(dateValue, months) {
  let date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) date = new Date();

  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months || 0));

  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getLiabilityBalance(liability) {
  if (!liability) return 0;
  const status = normalizeStatus(liability.status);
  if (["closed", "completed", "paid", "settled"].includes(status)) return 0;

  const currentBalance = firstDefined(
    liability.outstandingAmount,
    liability.remainingAmount,
    liability.balance
  );

  if (currentBalance !== undefined) return nonNegative(currentBalance);

  return nonNegative(
    firstDefined(liability.originalAmount, liability.loanAmount, liability.amount)
  );
}

function getLiabilityMonthlyPayment(liability) {
  return nonNegative(
    firstDefined(liability?.monthlyPayment, liability?.emi, liability?.monthlyEMI)
  );
}

function calculateLoanCompletion(liability = {}, balanceOverride) {
  const balance =
    balanceOverride !== undefined
      ? nonNegative(balanceOverride)
      : getLiabilityBalance(liability);

  const monthlyPayment = getLiabilityMonthlyPayment(liability);

  if (balance <= 0) {
    return {
      remainingPayments: 0,
      estimatedCompletionDate:
        liability.closedDate ||
        liability.closedAt?.slice?.(0, 10) ||
        new Date().toISOString().slice(0, 10),
    };
  }

  if (monthlyPayment <= 0) {
    return { remainingPayments: null, estimatedCompletionDate: null };
  }

  const remainingPayments = Math.ceil(balance / monthlyPayment);
  const baseDate = firstDefined(
    liability.nextPaymentDate,
    liability.nextDueDate,
    liability.dueDate,
    liability.startDate,
    new Date().toISOString().slice(0, 10)
  );

  const estimatedCompletionDate = addMonthsToDate(
    baseDate,
    Math.max(remainingPayments - 1, 0)
  );

  return { remainingPayments, estimatedCompletionDate };
}

function getGoalAvailableFund(goal) {
  if (!goal) return 0;
  if (goal.availableGoalFund !== undefined) return nonNegative(goal.availableGoalFund);

  const contributed = nonNegative(
    firstDefined(goal.totalContributed, goal.savedAmount, goal.alreadySaved)
  );
  const withdrawn = nonNegative(goal.totalWithdrawn);
  return Math.max(contributed - withdrawn, 0);
}

function getInvestmentCurrentValue(investment) {
  if (!investment) return 0;
  const status = normalizeStatus(investment.status);
  if (status === "closed" || status === "redeemed") return 0;

  if (status === "matured") {
    if (investment.maturityRemainingAmount !== undefined && investment.maturityRemainingAmount !== null) {
      return nonNegative(investment.maturityRemainingAmount);
    }
    return nonNegative(
      firstDefined(
        investment.actualMaturityValue,
        investment.maturityValue,
        investment.currentValue,
        investment.maturityAmount,
        investment.principalAmount,
        investment.amount,
        investment.investedAmount
      )
    );
  }

  return nonNegative(
    firstDefined(
      investment.currentValue,
      investment.principalAmount,
      investment.amount,
      investment.investedAmount
    )
  );
}

// ============================================================
// FINANCE PROVIDER COMPONENT
// ============================================================

function FinanceProvider({ children }) {
  const [userData, setUserData] = useState(() => {
    try {
      return getAuthUser();
    } catch (error) {
      console.error("Unable to load logged-in FinanceOS user:", error);
      return null;
    }
  });

  const [monthlyFinance, setMonthlyFinance] = useState(createDefaultMonthlyFinance);
  const [monthlyHistory, setMonthlyHistory] = useState([]);
  const [additionalIncomeTransactions, setAdditionalIncomeTransactions] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [savingGoals, setSavingGoals] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [insurancePolicies, setInsurancePolicies] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [netWorthSnapshots, setNetWorthSnapshots] = useState(() => {
    try {
      const saved = localStorage.getItem("financeos_networth_snapshots");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [userReminders, setUserReminders] = useState([]);

  // AI Suggestion State
  const [latestAISuggestion, setLatestAISuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingMessage, setAiLoadingMessage] = useState("Analyzing latest data...");
  const [aiError, setAiError] = useState(null);

  // Live Market Data State
  const [marketData, setMarketData] = useState(null);
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [marketDataLastReceived, setMarketDataLastReceived] = useState(null);

  // Real-time Market Data Streaming via Socket.IO
  useEffect(() => {
    let socket = null;
    try {
      const token = getAuthToken();
      socket = io("http://localhost:5000", {
        transports: ["websocket", "polling"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      socket.on("connect", () => {
        setSocketConnected(true);
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
      });

      socket.on("connect_error", () => {
        setSocketConnected(false);
      });

      // Genuine real-time market snapshot received from backend service
      socket.on("market:update", (updatedMarket) => {
        if (updatedMarket && typeof updatedMarket === "object") {
          setMarketData(updatedMarket);
          setMarketDataLastReceived(new Date());
        }
      });
    } catch (err) {
      console.warn("Socket.IO client initialization warning:", err);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Account Deleted Modal State & Invalidation Listener
  const [accountDeletedModalOpen, setAccountDeletedModalOpen] = useState(false);

  useEffect(() => {
    // 1. Subscribe to fetch interceptor account-deleted notification
    const unsubscribe = onAccountDeleted(() => {
      setAccountDeletedModalOpen(true);
      setUserData(null);
    });

    // 2. Periodic & visibility-based lightweight check for open tabs
    const checkAccountStatus = async () => {
      const token = getAuthToken();
      const user = getAuthUser();
      if (!token || !user || user.role === "admin") return;

      try {
        await fetch("http://localhost:5000/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (_) {}
    };

    const intervalId = setInterval(checkAccountStatus, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAccountStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleAccountDeletedRedirect = () => {
    setAccountDeletedModalOpen(false);
    clearAuthSession();
    window.location.href = "/signin";
  };

  const navigate = useNavigate();

  // Insufficient Funds Global Modal State
  const [insufficientFundsModal, setInsufficientFundsModal] = useState({
    isOpen: false,
    availableAmount: 0,
    requestedAmount: 0,
    message: "",
  });

  const formatINR = useCallback((val) => {
    const num = Math.round(Number(val) || 0);
    if (num < 0) return `-₹${Math.abs(num).toLocaleString("en-IN")}`;
    return `₹${num.toLocaleString("en-IN")}`;
  }, []);

  const showInsufficientFundsModal = useCallback(
    ({ availableAmount: passedAvailable, requestedAmount: passedRequested, message: passedMessage } = {}) => {
      const avail = Number.isFinite(Number(passedAvailable)) ? Number(passedAvailable) : 0;
      const req = Number.isFinite(Number(passedRequested)) ? Number(passedRequested) : 0;
      const msg =
        passedMessage ||
        `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
          avail
        )}, but the requested amount is ${formatINR(req)}.`;

      setInsufficientFundsModal({
        isOpen: true,
        availableAmount: avail,
        requestedAmount: req,
        message: msg,
      });
    },
    [formatINR]
  );

  const handleInsufficientFundsClose = useCallback(() => {
    setInsufficientFundsModal({
      isOpen: false,
      availableAmount: 0,
      requestedAmount: 0,
      message: "",
    });
    if (typeof navigate === "function") {
      navigate("/dashboard");
    } else {
      window.location.href = "/dashboard";
    }
  }, [navigate]);

  // Selected Dashboard View Month State (?month=YYYY-MM)
  const [selectedMonth, setSelectedMonthState] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        if (window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          const mParam = params.get("month") || params.get("returnMonth");
          if (mParam && /^\d{4}-\d{1,2}$/.test(mParam)) {
            const [y, m] = mParam.split("-");
            return `${y}-${String(m).padStart(2, "0")}`;
          }
        }
        const saved = sessionStorage.getItem("financeos_selected_month");
        if (saved && /^\d{4}-\d{1,2}$/.test(saved)) {
          const [y, m] = saved.split("-");
          return `${y}-${String(m).padStart(2, "0")}`;
        }
      }
    } catch (e) {}
    return "";
  });

  // Sidebar Collapsed State (User-Side)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return localStorage.getItem("financeos_sidebar_collapsed") === "true";
      }
    } catch (e) {}
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("financeos_sidebar_collapsed", String(next));
      } catch (e) {}
      return next;
    });
  };

  const setSelectedMonth = (monthStr) => {
    try {
      if (monthStr && /^\d{4}-\d{1,2}$/.test(monthStr)) {
        const [y, m] = monthStr.split("-");
        const formatted = `${y}-${String(m).padStart(2, "0")}`;
        setSelectedMonthState(formatted);
        sessionStorage.setItem("financeos_selected_month", formatted);
      } else {
        setSelectedMonthState("");
        sessionStorage.removeItem("financeos_selected_month");
      }
    } catch (e) {}
  };

  // ==========================================================
  // DATA LOADERS
  // ==========================================================

  const getInitialPeriod = () => {
    try {
      if (typeof window !== "undefined") {
        if (window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          const mParam = params.get("month") || params.get("returnMonth");
          if (mParam && /^\d{4}-\d{1,2}$/.test(mParam)) {
            const [y, m] = mParam.split("-");
            return { year: Number(y), month: Number(m) };
          }
        }
        const saved = sessionStorage.getItem("financeos_selected_month");
        if (saved && /^\d{4}-\d{1,2}$/.test(saved)) {
          const [y, m] = saved.split("-");
          return { year: Number(y), month: Number(m) };
        }
      }
    } catch (e) {}
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const loadMonthFinance = useCallback(async (targetYear, targetMonth) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const init = getInitialPeriod();
      const year = Number(targetYear) || init.year;
      const month = Number(targetMonth) || init.month;

      if (year && month) {
        const formatted = `${year}-${String(month).padStart(2, "0")}`;
        setSelectedMonthState(formatted);
        try {
          sessionStorage.setItem("financeos_selected_month", formatted);
        } catch (e) {}
      }

      const response = await fetch(
        `http://localhost:5000/api/monthly-finance/${year}/${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!data.success) return;

      if (data.finance) {
        const finance = data.finance;
        const opening =
          finance.openingBalance !== undefined
            ? finance.openingBalance
            : (finance.cashBalance || 0);

        setMonthlyFinance({
          year: finance.year,
          month: finance.month,
          income: finance.income,
          expenses: finance.expenses,
          cashBalance: opening,
          openingBalance: opening,
          closingBalance: finance.closingBalance,
          commitments: finance.commitments || 0,
          monthlySavings: finance.monthlySavings,
          updateDate: finance.updateDate,
          reminderEnabled: finance.reminderEnabled,
          emailNotification: finance.emailNotification,
          backendGoalAllocations: finance.goalAllocations || 0,
          calculationBreakdown: data.breakdown || data.calculationBreakdown || null,
          hasRecord: true,
        });
        setCashBalance(opening);
      } else {
        const opening = Number(data.carriedOpeningBalance || 0);
        setMonthlyFinance({
          year,
          month,
          income: 0,
          expenses: 0,
          cashBalance: opening,
          openingBalance: opening,
          closingBalance: opening,
          commitments: 0,
          monthlySavings: 0,
          updateDate: new Date(year, month - 1, 1).toISOString().split('T')[0],
          backendGoalAllocations: 0,
          calculationBreakdown: data.breakdown || data.calculationBreakdown || null,
          hasRecord: false,
        });
        setCashBalance(opening);
      }
    } catch (error) {
      console.error("Load Month Finance:", error);
    }
  }, []);

  const loadCurrentMonthFinance = (y, m) => {
    let year = Number(y);
    let month = Number(m);
    if (!year || !month) {
      const init = getInitialPeriod();
      year = init.year;
      month = init.month;
    }
    return loadMonthFinance(year, month);
  };

  const loadMonthlyHistory = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/monthly-finance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.history)) {
        setMonthlyHistory(
          data.history.map((r) => {
            const opening =
              r.openingBalance !== undefined
                ? r.openingBalance
                : (r.cashBalance || 0);
            const savings =
              r.monthlySavings !== undefined
                ? r.monthlySavings
                : r.income - r.expenses;
            const comm = Number(r.commitments || 0);
            const closing =
              r.closingBalance !== undefined
                ? r.closingBalance
                : opening + savings - comm;

            return {
              month: r.month,
              year: r.year,
              baseIncome: r.income,
              income: r.income,
              expenses: r.expenses,
              savings,
              openingBalance: opening,
              cashBalance: opening,
              closingBalance: closing,
              commitments: comm,
              totalCommitments: comm,
              availableToAllocate: opening + savings - comm,
              updateDate: r.updateDate,
              updatedAt: r.updatedAt,
            };
          })
        );
      }
    } catch (error) {
      console.error("Load Monthly History:", error);
    }
  };

  const loadSavingGoals = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/saving-goals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        setSavingGoals(
          data.goals.map((goal) => ({
            ...goal,
            id: goal._id,
            targetAmount: goal.targetAmount,
            alreadySaved: goal.alreadySaved || 0,
            savedAmount: goal.currentAmount || 0,
            totalContributed: goal.currentAmount || 0,
            monthlyContribution: goal.monthlyContribution,
            status: goal.status,
          }))
        );
      }
    } catch (error) {
      console.error("Load Saving Goals:", error);
    }
  };

  const loadInvestments = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `http://localhost:5000/api/investments?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load investments.");
      }

      const loadedInvestments = data.investments.map((investment) => ({
        ...investment,
        id: investment._id,
        amount: Number(investment.amount || 0),
        currentValue: Number(investment.currentValue ?? investment.amount ?? 0),
        monthlyContribution: Number(investment.monthlyContribution || 0),
        totalInterestReceived: Number(investment.totalInterestReceived || 0),
        sipContributions: Array.isArray(investment.sipContributions) ? investment.sipContributions : [],
      }));

      setInvestments(loadedInvestments);

      // Extract FD Interest transactions for dashboard
      const extractedIncome = [];
      loadedInvestments.forEach(inv => {
        if (Array.isArray(inv.interestTransactions)) {
          inv.interestTransactions.forEach(t => {
            extractedIncome.push({
              id: t.id || t._id || `fd-interest-${inv.id}-${t.date}`,
              type: "FD Interest",
              category: "Investment Income",
              amount: Number(t.amount),
              date: t.date,
              month: Number(t.month || new Date(t.date).getMonth() + 1),
              year: Number(t.year || new Date(t.date).getFullYear()),
              source: inv.name || inv.institution || "Fixed Deposit",
              investmentId: inv.id,
              referenceId: t.referenceId,
              note: t.note,
              createdAt: t.date
            });
          });
        }
      });
      setAdditionalIncomeTransactions(extractedIncome);
    } catch (error) {
      console.error("Load Investments:", error);
    }
  };

  const loadInsurances = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/insurances", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success || !data.insurances) return;

      const mappedInsurances = data.insurances.map((policy) => ({
        ...policy,
        id: policy._id,
        premium: policy.premiumAmount,
        monthlyPremium: policy.premiumAmount,
        monthlyEquivalent: calculateMonthlyEquivalent(policy.premiumAmount, policy.premiumFrequency),
      }));
      setInsurancePolicies(mappedInsurances);
    } catch (error) {
      console.error("Load Insurances:", error);
    }
  };

  const loadLiabilities = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/liabilities", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success || !data.liabilities) return;

      const mappedLiabilities = data.liabilities.map((l) => ({
        ...l,
        id: l._id,
        emi: l.monthlyEMI,
        monthlyPayment: l.monthlyEMI,
      }));
      setLiabilities(mappedLiabilities);
    } catch (error) {
      console.error("Load Liabilities:", error);
    }
  };

  const loadUserReminders = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/reminders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success || !data.data) return;

      setUserReminders(data.data);
    } catch (error) {
      console.error("Load User Reminders:", error);
    }
  };

  // ============================================================
  // REMINDER ACTIONS (Unified Live Sync)
  // ============================================================

  const updateLocalPlanReminderState = (sourceType, sourceId, enabled) => {
    if (sourceType === "SavingGoal") {
      setSavingGoals((prev) =>
        prev.map((g) =>
          g.id === sourceId || g._id === sourceId
            ? { ...g, reminder: { ...(g.reminder || {}), enabled } }
            : g
        )
      );
    } else if (sourceType === "Investment") {
      setInvestments((prev) =>
        prev.map((inv) =>
          inv.id === sourceId || inv._id === sourceId
            ? { ...inv, reminder: { ...(inv.reminder || {}), enabled } }
            : inv
        )
      );
    } else if (sourceType === "Insurance") {
      setInsurancePolicies((prev) =>
        prev.map((ins) =>
          ins.id === sourceId || ins._id === sourceId
            ? { ...ins, reminder: { ...(ins.reminder || {}), enabled } }
            : ins
        )
      );
    } else if (sourceType === "Liability") {
      setLiabilities((prev) =>
        prev.map((l) =>
          l.id === sourceId || l._id === sourceId
            ? { ...l, reminder: { ...(l.reminder || {}), enabled } }
            : l
        )
      );
    }
  };

  const updateItemReminder = async (sourceType, sourceId, reminderConfig) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false, message: "Authentication required." };

      const response = await fetch(`http://localhost:5000/api/reminders/source/${sourceType}/${sourceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reminderConfig),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update reminder.");
      }

      const isEnabled = reminderConfig.enabled !== false;
      updateLocalPlanReminderState(sourceType, sourceId, isEnabled);
      await loadUserReminders();
      return { success: true, data: data.data };
    } catch (err) {
      console.error("Update item reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const disableItemReminder = async (sourceType, sourceId) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/source/${sourceType}/${sourceId}/disable`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        updateLocalPlanReminderState(sourceType, sourceId, false);
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Disable reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const enableItemReminder = async (sourceType, sourceId) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/source/${sourceType}/${sourceId}/enable`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        updateLocalPlanReminderState(sourceType, sourceId, true);
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Enable reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const deleteItemReminder = async (sourceType, sourceId) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/source/${sourceType}/${sourceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        updateLocalPlanReminderState(sourceType, sourceId, false);
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Delete reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const createCustomReminder = async (reminderData) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch("http://localhost:5000/api/reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reminderData),
      });
      const data = await response.json();
      if (data.success) {
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Create custom reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const updateCustomReminder = async (reminderId, reminderData) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/${reminderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reminderData),
      });
      const data = await response.json();
      if (data.success) {
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Update custom reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const toggleCustomReminder = async (reminderId, enabled) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/${reminderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (data.success) {
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Toggle reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const deleteCustomReminder = async (reminderId) => {
    try {
      const token = getAuthToken();
      if (!token) return { success: false };

      const response = await fetch(`http://localhost:5000/api/reminders/${reminderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        await loadUserReminders();
      }
      return data;
    } catch (err) {
      console.error("Delete custom reminder error:", err);
      return { success: false, message: err.message };
    }
  };

  const [userMessages, setUserMessages] = useState([]);

  const loadUserMessages = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("http://localhost:5000/api/messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success || !data.data) return;

      setUserMessages(data.data);

      data.data.forEach((msg) => {
        addNotification({
          id: msg.id,
          rawId: msg.rawId,
          type: "message",
          title: msg.title,
          message: msg.message,
          category: msg.category || "General",
          priority: msg.priority || "Normal",
          source: msg.source || "FinanceOS Admin",
          notificationType: "admin",
          date: msg.createdAt,
          createdAt: msg.createdAt,
          read: Boolean(msg.read),
          readAt: msg.readAt,
        });
      });
    } catch (error) {
      console.error("Load User Messages:", error);
    }
  };

  useEffect(() => {
    // Reset user-specific items on user switch or logout
    setNotifications([]);
    setUserMessages([]);
    setUserReminders([]);

    const fetchData = async () => {
      if (!userData) return;
      try {
        await loadCurrentMonthFinance();
        await loadMonthlyHistory();
        await loadSavingGoals();
        await loadInvestments();
        await loadInsurances();
        await loadLiabilities();
        await loadUserReminders();
        await loadUserMessages();
        await fetchLatestAISuggestion();
      } catch (error) {
        console.error("FinanceProvider: Failed to load finance data:", error);
      }
    };
    fetchData();

    const handleFocus = () => {
      if (userData) {
        loadUserMessages();
        loadUserReminders();
      }
    };
    window.addEventListener("focus", handleFocus);
    const interval = setInterval(handleFocus, 20000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [userData]);

  // ==========================================================
  // INCOME CALCULATIONS & ACTIONS
  // ==========================================================

  const getAdditionalIncomeForMonth = (month, year) => {
    return additionalIncomeTransactions
      .filter(
        (t) => Number(t.month) === Number(month) && Number(t.year) === Number(year)
      )
      .reduce((total, t) => total + safeNumber(t.amount), 0);
  };

  const additionalIncome = useMemo(
    () => getAdditionalIncomeForMonth(monthlyFinance.month, monthlyFinance.year),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additionalIncomeTransactions, monthlyFinance.month, monthlyFinance.year]
  );

  const baseMonthlyIncome = useMemo(
    () => nonNegative(monthlyFinance.income),
    [monthlyFinance.income]
  );

  const totalMonthlyIncome = useMemo(
    () => baseMonthlyIncome + additionalIncome,
    [baseMonthlyIncome, additionalIncome]
  );

  const recordAdditionalIncome = (incomeData = {}) => {
    const amount = safeNumber(incomeData.amount);
    if (amount <= 0) {
      return { success: false, message: "Enter a valid income amount." };
    }

    const date = incomeData.date || new Date().toISOString().slice(0, 10);
    const dateInfo = getMonthYearFromDate(date);
    const month = Number(incomeData.month ?? dateInfo.month);
    const year = Number(incomeData.year ?? dateInfo.year);

    if (month < 1 || month > 12 || !Number.isFinite(year)) {
      return { success: false, message: "Invalid income date." };
    }

    if (incomeData.referenceId) {
      const duplicate = additionalIncomeTransactions.some(
        (t) => t.referenceId === incomeData.referenceId
      );
      if (duplicate) {
        return { success: false, message: "This income transaction has already been recorded." };
      }
    }

    const transaction = {
      id: incomeData.id || createId("income"),
      type: incomeData.type || "Other Income",
      category: incomeData.category || "Additional Income",
      amount,
      date,
      month,
      year,
      source: incomeData.source || "",
      investmentId: incomeData.investmentId || null,
      referenceId: incomeData.referenceId || null,
      note: incomeData.note || "",
      createdAt: incomeData.createdAt || new Date().toISOString(),
    };

    setAdditionalIncomeTransactions((current) => [...current, transaction]);

    setMonthlyHistory((history) =>
      history.map((record) => {
        if (Number(record.month) !== month || Number(record.year) !== year) {
          return record;
        }

        const baseIncome =
          record.baseIncome !== undefined
            ? nonNegative(record.baseIncome)
            : Math.max(safeNumber(record.income) - safeNumber(record.additionalIncome), 0);

        const newAdditionalIncome = nonNegative(record.additionalIncome) + amount;
        const newTotalIncome = baseIncome + newAdditionalIncome;
        const expenses = nonNegative(record.expenses);
        const savings = newTotalIncome - expenses;
        const commitments = nonNegative(record.totalCommitments);

        return {
          ...record,
          baseIncome,
          additionalIncome: newAdditionalIncome,
          totalIncome: newTotalIncome,
          income: newTotalIncome,
          savings,
          availableToAllocate: cashBalance + savings - commitments,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    return { success: true, transaction, message: "Additional income recorded successfully." };
  };

  const deleteAdditionalIncomeTransaction = (id) => {
    const transaction = additionalIncomeTransactions.find((item) => item.id === id);
    if (!transaction) {
      return { success: false, message: "Income transaction not found." };
    }

    setAdditionalIncomeTransactions((current) => current.filter((item) => item.id !== id));

    setMonthlyHistory((history) =>
      history.map((record) => {
        if (
          Number(record.month) !== Number(transaction.month) ||
          Number(record.year) !== Number(transaction.year)
        ) {
          return record;
        }

        const baseIncome =
          record.baseIncome !== undefined
            ? nonNegative(record.baseIncome)
            : Math.max(safeNumber(record.income) - safeNumber(record.additionalIncome), 0);

        const newAdditionalIncome = Math.max(
          safeNumber(record.additionalIncome) - safeNumber(transaction.amount),
          0
        );
        const newTotalIncome = baseIncome + newAdditionalIncome;
        const expenses = nonNegative(record.expenses);
        const savings = newTotalIncome - expenses;
        const commitments = nonNegative(record.totalCommitments);

        return {
          ...record,
          baseIncome,
          additionalIncome: newAdditionalIncome,
          totalIncome: newTotalIncome,
          income: newTotalIncome,
          savings,
          availableToAllocate: cashBalance + savings - commitments,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    return { success: true, message: "Income transaction deleted." };
  };

  // ==========================================================
  // FD INTEREST ACTIONS
  // ==========================================================

  const recordFDInterest = async (investmentId, interestData = {}) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return { success: false, message: "Authentication token not found." };
      }

      const investment = investments.find((item) => item.id === investmentId);
      if (!investment) return { success: false, message: "Fixed deposit not found." };

      const investmentType = String(investment.type || "").trim().toLowerCase();
      if (investmentType !== "fixed deposit") {
        return { success: false, message: "Interest can only be recorded here for a fixed deposit." };
      }

      const interestMethod = String(investment.interestMethod || "").trim().toLowerCase();
      if (interestMethod === "cumulative") {
        return { success: false, message: "This is a cumulative FD. Interest remains inside the FD until maturity." };
      }

      if (normalizeStatus(investment.status) === "closed") {
        return { success: false, message: "Interest cannot be recorded for a closed FD." };
      }

      const amount = safeNumber(interestData.amount);
      if (amount <= 0) {
        return { success: false, message: "Enter the actual FD interest amount credited by the bank." };
      }

      const date = interestData.date || new Date().toISOString().slice(0, 10);
      const dateInfo = getMonthYearFromDate(date);
      const transactionMonth = Number(dateInfo.month);
      const transactionYear = Number(dateInfo.year);
      const referenceId = interestData.referenceId || `fd-interest-${investmentId}-${date}`;

      const duplicate = Array.isArray(investment.interestTransactions) && 
        investment.interestTransactions.some(
          (t) => Number(t.month) === transactionMonth && Number(t.year) === transactionYear
        );
      if (duplicate) {
        return { success: false, message: `FD interest for ${transactionMonth}/${transactionYear} has already been recorded.` };
      }

      const transaction = {
        id: createId("fd-interest"),
        type: "FD Interest",
        category: "Investment Income",
        amount,
        date,
        month: transactionMonth,
        year: transactionYear,
        source: investment.name || investment.institution || "Fixed Deposit",
        investmentId,
        referenceId,
        note: interestData.note || `Interest received from ${investment.name || "Fixed Deposit"}`,
        createdAt: new Date().toISOString(),
      };

      // API CALL TO BACKEND
      const response = await fetch(`http://localhost:5000/api/investments/${investmentId}/interest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transaction),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to record FD interest.");
      }

      setAdditionalIncomeTransactions((current) => [...current, transaction]);

    setInvestments((current) =>
      current.map((item) => {
        if (item.id !== investmentId) return item;
        return {
          ...item,
          totalInterestReceived: safeNumber(item.totalInterestReceived) + amount,
          lastInterestReceivedAt: date,
          interestTransactions: [
            ...(Array.isArray(item.interestTransactions) ? item.interestTransactions : []),
            {
              id: transaction.id,
              amount,
              date,
              month: transactionMonth,
              year: transactionYear,
              referenceId,
              note: transaction.note,
              createdAt: transaction.createdAt,
            },
          ],
        };
      })
    );

    setMonthlyHistory((history) =>
      history.map((record) => {
        if (Number(record.month) !== transactionMonth || Number(record.year) !== transactionYear) {
          return record;
        }

        const baseIncome =
          record.baseIncome !== undefined
            ? nonNegative(record.baseIncome)
            : Math.max(safeNumber(record.income) - safeNumber(record.additionalIncome), 0);

        const newAdditionalIncome = nonNegative(record.additionalIncome) + amount;
        const newTotalIncome = baseIncome + newAdditionalIncome;
        const expenses = nonNegative(record.expenses);
        const savings = newTotalIncome - expenses;
        const commitments = nonNegative(record.totalCommitments);

        return {
          ...record,
          baseIncome,
          additionalIncome: newAdditionalIncome,
          totalIncome: newTotalIncome,
          income: newTotalIncome,
          expenses,
          savings,
          availableToAllocate: cashBalance + savings - commitments,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setNetWorthSnapshots((snapshots) =>
      snapshots.map((snapshot) => {
        if (Number(snapshot.month) !== transactionMonth || Number(snapshot.year) !== transactionYear) {
          return snapshot;
        }

        const baseIncome =
          snapshot.baseIncome !== undefined
            ? nonNegative(snapshot.baseIncome)
            : Math.max(safeNumber(snapshot.income) - safeNumber(snapshot.additionalIncome), 0);

        const newAdditionalIncome = nonNegative(snapshot.additionalIncome) + amount;
        const newTotalIncome = baseIncome + newAdditionalIncome;
        const expenses = nonNegative(snapshot.expenses);
        const savings = newTotalIncome - expenses;
        const commitments = nonNegative(snapshot.totalCommitments);

        return {
          ...snapshot,
          baseIncome,
          additionalIncome: newAdditionalIncome,
          totalIncome: newTotalIncome,
          income: newTotalIncome,
          savings,
          availableToAllocate: cashBalance + savings - commitments,
          updatedAt: new Date().toISOString(),
        };
      })
    );

      return {
        success: true,
        transaction,
        message: `FD interest of ₹${amount.toLocaleString("en-US")} was added to ${transactionMonth}/${transactionYear} income.`,
      };
    } catch (error) {
      console.error("recordFDInterest Error:", error);
      return { success: false, message: error.message || "Failed to record FD interest." };
    }
  };

  // ==========================================================
  // ACTIVE COMPUTATIONS
  // ==========================================================
  // ACTIVE WORKING PERIOD & MONTH-AWARE ITEM LISTS
  // ==========================================================

  const activeWorkingPeriod = useMemo(() => {
    return parseSelectedMonth(selectedMonth);
  }, [selectedMonth]);

  // Visible items filtered strictly by creation/start & closure lifecycle
  const visibleSavingGoals = useMemo(
    () =>
      savingGoals.filter((g) =>
        isItemActiveInMonth(g, activeWorkingPeriod.year, activeWorkingPeriod.month)
      ),
    [savingGoals, activeWorkingPeriod.year, activeWorkingPeriod.month]
  );

  const visibleInvestments = useMemo(
    () =>
      investments.filter((i) =>
        isItemActiveInMonth(i, activeWorkingPeriod.year, activeWorkingPeriod.month)
      ),
    [investments, activeWorkingPeriod.year, activeWorkingPeriod.month]
  );

  const visibleInsurancePolicies = useMemo(
    () =>
      insurancePolicies.filter((p) =>
        isItemActiveInMonth(p, activeWorkingPeriod.year, activeWorkingPeriod.month)
      ),
    [insurancePolicies, activeWorkingPeriod.year, activeWorkingPeriod.month]
  );

  const visibleLiabilities = useMemo(
    () =>
      liabilities.filter((l) =>
        isItemActiveInMonth(l, activeWorkingPeriod.year, activeWorkingPeriod.month)
      ),
    [liabilities, activeWorkingPeriod.year, activeWorkingPeriod.month]
  );

  const activeSavingGoals = useMemo(
    () => visibleSavingGoals.filter((g) => normalizeStatus(g.status) === "active"),
    [visibleSavingGoals]
  );

  const activeInvestments = useMemo(
    () => investments.filter((i) => normalizeStatus(i.status) === "active"),
    [investments]
  );

  const activeInsurancePolicies = useMemo(
    () => insurancePolicies.filter((p) => normalizeStatus(p.status) === "active"),
    [insurancePolicies]
  );

  const activeLiabilities = useMemo(
    () =>
      liabilities.filter((l) => {
        const status = normalizeStatus(l.status);
        const balance = getLiabilityBalance(l);
        return balance > 0 && !["closed", "completed", "paid", "settled"].includes(status);
      }),
    [liabilities]
  );

  // ==========================================================
  // MONTHLY COMMITMENTS & BUDGETING
  // ==========================================================

  const goalMonthlyCommitment = useMemo(() => {
    const currentYear = activeWorkingPeriod.year;
    const currentMonth = activeWorkingPeriod.month;

    let actualContributionsThisMonth = 0;
    visibleSavingGoals.forEach((goal) => {
      const txs = Array.isArray(goal.contributions)
        ? goal.contributions
        : Array.isArray(goal.transactions)
        ? goal.transactions
        : [];

      if (txs.length > 0) {
        txs.forEach((tx) => {
          if (tx.type === "contribution" || !tx.type) {
            const txDate = tx.date ? new Date(tx.date) : (tx.createdAt ? new Date(tx.createdAt) : null);
            if (txDate && !isNaN(txDate.getTime())) {
              if (txDate.getFullYear() === currentYear && (txDate.getMonth() + 1) === currentMonth) {
                actualContributionsThisMonth += safeNumber(tx.amount);
              }
            }
          }
        });
      }
    });

    const backendAllocations = safeNumber(monthlyFinance.goalAllocations);
    return Math.max(actualContributionsThisMonth, backendAllocations);
  }, [visibleSavingGoals, activeWorkingPeriod.year, activeWorkingPeriod.month, monthlyFinance.goalAllocations]);

  const investmentMonthlyCommitment = useMemo(
    () =>
      visibleInvestments
        .filter((i) => normalizeStatus(i.status) === "active")
        .reduce(
          (total, i) =>
            total + nonNegative(firstDefined(i.monthlyContribution, i.monthlyAmount)),
          0
        ),
    [visibleInvestments]
  );

  const insuranceMonthlyCommitment = useMemo(
    () =>
      visibleInsurancePolicies
        .filter((p) => normalizeStatus(p.status) === "active")
        .reduce(
          (total, p) =>
            total + nonNegative(firstDefined(p.monthlyEquivalent, p.monthlyPremium)),
          0
        ),
    [visibleInsurancePolicies]
  );

  const liabilityMonthlyCommitment = useMemo(
    () =>
      visibleLiabilities
        .filter((l) => {
          const status = normalizeStatus(l.status);
          const balance = getLiabilityBalance(l);
          return balance > 0 && !["closed", "completed", "paid", "settled"].includes(status);
        })
        .reduce(
          (total, l) => total + getLiabilityMonthlyPayment(l),
          0
        ),
    [visibleLiabilities]
  );

  // ==========================================================
  // ACTUAL OUTFLOWS THIS MONTH (ONLY ACTUAL CASH DEDUCTED)
  // ==========================================================

  const actualInvestmentOutflow = useMemo(() => {
    const currentYear = activeWorkingPeriod.year;
    const currentMonth = activeWorkingPeriod.month;
    let sum = 0;
    visibleInvestments.forEach((inv) => {
      if (Array.isArray(inv.sipContributions)) {
        inv.sipContributions.forEach((sc) => {
          const scDate = sc.paidDate || sc.dueDate;
          if (isDateInPeriod(scDate, currentYear, currentMonth) && sc.status === "Paid") {
            sum += safeNumber(sc.amount);
          }
        });
      }
    });
    return sum;
  }, [visibleInvestments, activeWorkingPeriod.year, activeWorkingPeriod.month]);

  const actualGoalOutflow = useMemo(() => {
    const currentYear = activeWorkingPeriod.year;
    const currentMonth = activeWorkingPeriod.month;
    let sum = 0;
    visibleSavingGoals.forEach((goal) => {
      const txs = Array.isArray(goal.contributions)
        ? goal.contributions
        : Array.isArray(goal.transactions)
        ? goal.transactions
        : [];
      txs.forEach((tx) => {
        const txDate = tx.date || tx.createdAt;
        if (isDateInPeriod(txDate, currentYear, currentMonth)) {
          sum += safeNumber(tx.amount);
        }
      });
    });
    const backendAllocations = safeNumber(monthlyFinance.goalAllocations);
    return Math.max(sum, backendAllocations);
  }, [visibleSavingGoals, activeWorkingPeriod.year, activeWorkingPeriod.month, monthlyFinance.goalAllocations]);

  const actualInsuranceOutflow = useMemo(() => {
    const currentYear = activeWorkingPeriod.year;
    const currentMonth = activeWorkingPeriod.month;
    let sum = 0;
    visibleInsurancePolicies.forEach((ins) => {
      if (Array.isArray(ins.payments)) {
        ins.payments.forEach((p) => {
          const pDate = p.paidDate || p.dueDate || p.date;
          if (isDateInPeriod(pDate, currentYear, currentMonth) && (p.status === "Paid" || p.paid)) {
            sum += safeNumber(p.amount);
          }
        });
      }
    });
    return sum;
  }, [visibleInsurancePolicies, activeWorkingPeriod.year, activeWorkingPeriod.month]);

  const actualLiabilityOutflow = useMemo(() => {
    const currentYear = activeWorkingPeriod.year;
    const currentMonth = activeWorkingPeriod.month;
    let sum = 0;
    visibleLiabilities.forEach((liab) => {
      if (Array.isArray(liab.payments)) {
        liab.payments.forEach((p) => {
          const pDate = p.paidDate || p.dueDate || p.date;
          if (isDateInPeriod(pDate, currentYear, currentMonth) && (p.status === "Paid" || p.paid)) {
            sum += safeNumber(p.amount);
          }
        });
      }
    });
    return sum;
  }, [visibleLiabilities, activeWorkingPeriod.year, activeWorkingPeriod.month]);

  const totalActualOutflowCommitments = useMemo(() => {
    return (
      actualInvestmentOutflow +
      actualGoalOutflow +
      actualInsuranceOutflow +
      actualLiabilityOutflow
    );
  }, [
    actualInvestmentOutflow,
    actualGoalOutflow,
    actualInsuranceOutflow,
    actualLiabilityOutflow,
  ]);

  const totalPlannedMonthlyCommitments = useMemo(
    () =>
      goalMonthlyCommitment +
      investmentMonthlyCommitment +
      insuranceMonthlyCommitment +
      liabilityMonthlyCommitment,
    [
      goalMonthlyCommitment,
      investmentMonthlyCommitment,
      insuranceMonthlyCommitment,
      liabilityMonthlyCommitment,
    ]
  );

  const totalMonthlyCommitments = totalActualOutflowCommitments;

  const updateMonthlyFinance = (financeData = {}) => {
    setMonthlyFinance((current) => {
      const updated = {
        ...current,
        ...financeData,
        reminder: {
          ...current.reminder,
          ...(financeData.reminder || {}),
          channels: {
            ...current.reminder?.channels,
            ...(financeData.reminder?.channels || {}),
          },
        },
      };

      const month = Number(updated.month || new Date().getMonth() + 1);
      const year = Number(updated.year || new Date().getFullYear());
      const baseIncome = nonNegative(updated.income);
      const expenses = nonNegative(updated.expenses);
      const opening = nonNegative(
        updated.openingBalance !== undefined
          ? updated.openingBalance
          : updated.cashBalance
      );

      const monthAdditionalIncome = additionalIncomeTransactions
        .filter((t) => Number(t.month) === month && Number(t.year) === year)
        .reduce((total, t) => total + safeNumber(t.amount), 0);

      const totalIncome = baseIncome + monthAdditionalIncome;
      const savings = totalIncome - expenses;
      const currentTotalCommitments =
        goalMonthlyCommitment +
        investmentMonthlyCommitment +
        insuranceMonthlyCommitment +
        liabilityMonthlyCommitment;

      const computedClosing = opening + savings - currentTotalCommitments;

      setMonthlyHistory((history) => {
        const existingIndex = history.findIndex(
          (r) => Number(r.month) === month && Number(r.year) === year
        );

        const monthlyRecord = {
          month,
          year,
          baseIncome,
          additionalIncome: monthAdditionalIncome,
          totalIncome,
          income: totalIncome,
          expenses,
          savings,
          openingBalance: opening,
          cashBalance: opening,
          closingBalance: computedClosing,
          goalCommitment: goalMonthlyCommitment,
          investmentCommitment: investmentMonthlyCommitment,
          insuranceCommitment: insuranceMonthlyCommitment,
          liabilityCommitment: liabilityMonthlyCommitment,
          totalCommitments: currentTotalCommitments,
          availableToAllocate: opening + savings - currentTotalCommitments,
          updatedAt: new Date().toISOString(),
        };

        if (existingIndex !== -1) {
          return history.map((r, i) => (i === existingIndex ? { ...r, ...monthlyRecord } : r));
        }
        return [...history, monthlyRecord];
      });

      return {
        ...updated,
        month,
        year,
        income: baseIncome,
        expenses,
        openingBalance: opening,
        cashBalance: opening,
        closingBalance: computedClosing,
      };
    });
  };

  const openingBalance = useMemo(
    () =>
      nonNegative(
        monthlyFinance.openingBalance !== undefined
          ? monthlyFinance.openingBalance
          : monthlyFinance.cashBalance
      ),
    [monthlyFinance.openingBalance, monthlyFinance.cashBalance]
  );

  const monthlySavings = useMemo(
    () => totalMonthlyIncome - nonNegative(monthlyFinance.expenses),
    [totalMonthlyIncome, monthlyFinance.expenses]
  );

  const availableToAllocate = useMemo(
    () => openingBalance + monthlySavings - totalActualOutflowCommitments,
    [openingBalance, monthlySavings, totalActualOutflowCommitments]
  );

  const closingBalance = useMemo(
    () => openingBalance + monthlySavings - totalActualOutflowCommitments,
    [openingBalance, monthlySavings, totalActualOutflowCommitments]
  );

  // ==========================================================
  // REAL-TIME CASH FLOW BREAKDOWN (SINGLE CALCULATION ENGINE)
  // ==========================================================

  const cashFlowBreakdown = useMemo(() => {
    return deriveCashFlowBreakdown({
      monthlyFinance,
      previousMonthRecord: null,
      investments: visibleInvestments,
      savingGoals: visibleSavingGoals,
      insurancePolicies: visibleInsurancePolicies,
      liabilities: visibleLiabilities,
      additionalIncomes: additionalIncomeTransactions,
      selectedYear: activeWorkingPeriod.year,
      selectedMonth: activeWorkingPeriod.month,
      backendBreakdown: monthlyFinance.calculationBreakdown || null,
    });
  }, [
    monthlyFinance,
    visibleInvestments,
    visibleSavingGoals,
    visibleInsurancePolicies,
    visibleLiabilities,
    additionalIncomeTransactions,
    activeWorkingPeriod.year,
    activeWorkingPeriod.month,
  ]);

  const updateCashBalance = (amount) => {
    const value = safeNumber(amount);
    setCashBalance(value);
    setMonthlyFinance((curr) => ({
      ...curr,
      cashBalance: value,
      openingBalance: value,
    }));
    return true;
  };

  // ==========================================================
  // SAVING GOALS ACTIONS
  // ==========================================================

  const addSavingGoal = async (goal = {}) => {
    const targetAmount = nonNegative(firstDefined(goal.targetAmount, goal.amount));
    const initialSaved = nonNegative(firstDefined(goal.initialContribution, goal.savedAmount, goal.alreadySaved));
    const monthlyContribution = nonNegative(
      firstDefined(goal.monthlyContribution, goal.monthlyAllocation, goal.requiredMonthly)
    );

    const fundLocation = {
      type: goal.fundLocation?.type || goal.fundLocationType || "",
      institution: goal.fundLocation?.institution || goal.institution || "",
      label: goal.fundLocation?.label || goal.accountLabel || "",
      lastFour: goal.fundLocation?.lastFour || goal.lastFour || "",
    };

    const token = getAuthToken();

    const payload = {
      goalName: goal.goalName || goal.name,
      category: goal.category || "Other",
      targetAmount,
      initialContribution: initialSaved,
      alreadySaved: initialSaved,
      currentAmount: initialSaved,
      monthlyContribution,
      startDate: goal.startDate || new Date().toISOString().slice(0, 10),
      targetDate: goal.targetDate,
      status: goal.status || "Active",
      notes: goal.notes || "",
      fundLocation,
      initialContributionDate: goal.initialContributionDate || goal.startDate,
      initialContributionSource: goal.initialContributionSource || "Existing Savings",
      reminder: goal.reminder,
    };

    const response = await fetch("http://localhost:5000/api/saving-goals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      if (data.code === "INSUFFICIENT_FUNDS") {
        showInsufficientFundsModal({
          availableAmount: data.availableAmount,
          requestedAmount: data.requestedAmount,
          message: data.message,
        });
        const err = new Error(data.message || "Insufficient funds available.");
        err.code = "INSUFFICIENT_FUNDS";
        err.availableAmount = data.availableAmount;
        err.requestedAmount = data.requestedAmount;
        throw err;
      }
      throw new Error(data.message || "Failed to save saving goal.");
    }

    const createdGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
      alreadySaved: data.goal.alreadySaved || 0,
    };

    setSavingGoals((current) => [createdGoal, ...current]);
    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);
    await loadCurrentMonthFinance();

    return createdGoal;
  };

  const updateSavingGoal = async (id, updates = {}) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/saving-goals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update saving goal.");
    }

    const updatedGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((g) => (g.id === id || g._id === id ? updatedGoal : g))
    );

    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);
    await loadCurrentMonthFinance();

    return updatedGoal;
  };

  const deleteSavingGoal = async (id) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/saving-goals/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete saving goal.");
    }

    setSavingGoals((current) =>
      current.filter((goal) => goal.id !== id && goal._id !== id)
    );

    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);
    await loadCurrentMonthFinance();
  };

  const updateGoalFundLocation = async (id, location = {}) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/saving-goals/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fundLocation: location }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update fund location.");
    }

    const updatedGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((goal) =>
        goal.id === id || goal._id === id ? updatedGoal : goal
      )
    );

    return updatedGoal;
  };

  const addGoalContribution = async (id, contributionData) => {
    const token = getAuthToken();

    const targetMonthIso = contributionData.selectedMonth || selectedMonth || activeWorkingPeriod.iso;
    const reqAmount = Number(contributionData.amount);

    if (targetMonthIso === activeWorkingPeriod.iso && Number.isFinite(reqAmount) && reqAmount > availableToAllocate) {
      showInsufficientFundsModal({
        availableAmount: availableToAllocate,
        requestedAmount: reqAmount,
      });
      const err = new Error(
        `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
          availableToAllocate
        )}, but the requested amount is ${formatINR(reqAmount)}.`
      );
      err.code = "INSUFFICIENT_FUNDS";
      err.availableAmount = availableToAllocate;
      err.requestedAmount = reqAmount;
      throw err;
    }

    const response = await fetch(
      `http://localhost:5000/api/saving-goals/${id}/contribution`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: contributionData.amount,
          date: contributionData.date,
          selectedMonth: targetMonthIso,
          source: contributionData.source || "Monthly Savings",
          note: contributionData.note || "",
          paymentDetails: contributionData.paymentDetails || {},
          fundLocation: contributionData.fundLocation,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      if (data.code === "INSUFFICIENT_FUNDS") {
        showInsufficientFundsModal({
          availableAmount: data.availableAmount,
          requestedAmount: data.requestedAmount,
          message: data.message,
        });
        const err = new Error(data.message || "Insufficient funds available.");
        err.code = "INSUFFICIENT_FUNDS";
        err.availableAmount = data.availableAmount;
        err.requestedAmount = data.requestedAmount;
        throw err;
      }
      throw new Error(data.message || "Failed to add contribution.");
    }

    const updatedGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((goal) =>
        goal.id === id || goal._id === id
          ? updatedGoal
          : goal
      )
    );

    // Immediately reload working month finance to synchronize Available to Allocate in real time
    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);

    return updatedGoal;
  };

  const updateGoalContribution = async (goalId, contributionId, updateData) => {
    const token = getAuthToken();

    const response = await fetch(
      `http://localhost:5000/api/saving-goals/${goalId}/contribution/${contributionId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      if (data.code === "INSUFFICIENT_FUNDS") {
        showInsufficientFundsModal({
          availableAmount: data.availableAmount,
          requestedAmount: data.requestedAmount,
          message: data.message,
        });
        const err = new Error(data.message || "Insufficient funds available.");
        err.code = "INSUFFICIENT_FUNDS";
        err.availableAmount = data.availableAmount;
        err.requestedAmount = data.requestedAmount;
        throw err;
      }
      throw new Error(data.message || "Failed to update contribution.");
    }

    const updatedGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((g) => (g.id === goalId || g._id === goalId ? updatedGoal : g))
    );

    await loadCurrentMonthFinance();
    return updatedGoal;
  };

  const deleteGoalContribution = async (goalId, contributionId) => {
    const token = getAuthToken();

    const response = await fetch(
      `http://localhost:5000/api/saving-goals/${goalId}/contribution/${contributionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete contribution.");
    }

    const updatedGoal = {
      ...data.goal,
      id: data.goal._id,
      savedAmount: data.goal.currentAmount || 0,
      totalContributed: data.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((g) => (g.id === goalId || g._id === goalId ? updatedGoal : g))
    );

    await loadCurrentMonthFinance();
    return updatedGoal;
  };

  const withdrawGoalFunds = async (id, withdrawalData) => {
    const data = typeof withdrawalData === "object" ? withdrawalData : { amount: withdrawalData };
    const withdrawal = safeNumber(data?.amount);

    if (withdrawal <= 0) {
      return { success: false, message: "Enter a valid withdrawal amount." };
    }

    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/saving-goals/${id}/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: withdrawal,
        date: data.date || new Date().toISOString().slice(0, 10),
        purpose: data.purpose || "Goal fund used",
        note: data.note || "",
      }),
    });

    const resData = await response.json();
    if (!response.ok || !resData.success) {
      throw new Error(resData.message || "Failed to withdraw funds.");
    }

    const updatedGoal = {
      ...resData.goal,
      id: resData.goal._id,
      savedAmount: resData.goal.currentAmount || 0,
      totalContributed: resData.goal.currentAmount || 0,
    };

    setSavingGoals((current) =>
      current.map((g) => (g.id === id || g._id === id ? updatedGoal : g))
    );

    return { success: true, goal: updatedGoal };
  };

  const settleSavingGoal = (id) => {
    let result = { success: false, message: "Saving goal not found." };

    setSavingGoals((current) =>
      current.map((goal) => {
        if (goal.id !== id) return goal;

        const target = nonNegative(goal.targetAmount);
        const contributed = nonNegative(firstDefined(goal.totalContributed, goal.savedAmount));

        if (target > 0 && contributed < target) {
          result = { success: false, message: "The saving goal has not been completed yet." };
          return goal;
        }

        result = { success: true, message: "Saving goal settled successfully." };

        return {
          ...goal,
          status: "Settled",
          monthlyContribution: 0,
          monthlyAllocation: 0,
          settledAt: new Date().toISOString(),
          settlementAction: "Keep Saved",
        };
      })
    );

    return result;
  };

  // ==========================================================
  // INVESTMENT ACTIONS
  // ==========================================================

  const addInvestment = async (investment = {}) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return { success: false, message: "Authentication token not found." };
      }

      const amount = nonNegative(firstDefined(investment.amount, investment.investedAmount));
      if (amount <= 0) {
        return { success: false, message: "Investment amount must be greater than 0." };
      }

      const isFD = String(investment.type || "").trim().toLowerCase() === "fixed deposit";
      const isOneTime = String(investment.contributionType || "").toLowerCase() === "one time" || String(investment.contributionType || "").toLowerCase() === "one-time";
      const isStocks = String(investment.type || "").trim().toLowerCase() === "stocks";
      const isGold = String(investment.type || "").trim().toLowerCase() === "gold";
      const consumesFunds = isFD || isOneTime || isStocks || isGold || investment.consumeAvailableFunds === true;

      if (consumesFunds && amount > availableToAllocate) {
        showInsufficientFundsModal({
          availableAmount: availableToAllocate,
          requestedAmount: amount,
        });
        return {
          success: false,
          code: "INSUFFICIENT_FUNDS",
          availableAmount: availableToAllocate,
          requestedAmount: amount,
          message: `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
            availableToAllocate
          )}, but the requested amount is ${formatINR(amount)}.`,
        };
      }

      const investmentData = {
        name: investment.name,
        type: investment.type,
        amount,
        paymentSource: investment.paymentSource || undefined,
        paymentSourceDetails: {
          bankName: investment.paymentSourceDetails?.bankName || "",
          accountLast4: investment.paymentSourceDetails?.accountLast4 || "",
          upiId: investment.paymentSourceDetails?.upiId || "",
          otherDetails: investment.paymentSourceDetails?.otherDetails || "",
        },
        contributionType: investment.contributionType || "Recurring",
        frequency: investment.frequency || null,
        monthlyContribution: isFD
          ? 0
          : nonNegative(
              firstDefined(investment.monthlyContribution, investment.monthlyAmount)
            ),
        startDate: investment.startDate || null,
        nextContributionDate: investment.nextContributionDate || null,
        maturityDate: investment.maturityDate || null,
        dueDay: investment.dueDay !== undefined ? investment.dueDay : null,
        status: investment.status || "Active",
        institution: investment.institution || "",
        principalAmount: isFD
          ? nonNegative(firstDefined(investment.principalAmount, amount))
          : undefined,
        interestRate: (isFD || investment.type === "Recurring Deposit") ? nonNegative(investment.interestRate) : undefined,
        interestMethod: isFD ? investment.interestMethod || "Payout" : undefined,
        interestPayoutFrequency: isFD ? investment.interestPayoutFrequency || null : undefined,
        compoundingFrequency: isFD ? investment.compoundingFrequency || null : undefined,
        estimatedInterest: isFD ? nonNegative(investment.estimatedInterest) : 0,
        estimatedAnnualInterest: isFD ? nonNegative(investment.estimatedAnnualInterest) : 0,
        estimatedInterestPerPayout: isFD ? nonNegative(investment.estimatedInterestPerPayout) : 0,
        estimatedMaturityAmount: isFD ? nonNegative(investment.estimatedMaturityAmount) : 0,
        totalInterestReceived: isFD ? nonNegative(investment.totalInterestReceived) : 0,
        interestTransactions:
          isFD && Array.isArray(investment.interestTransactions)
            ? investment.interestTransactions
            : [],
        weight: investment.weight !== undefined ? Number(investment.weight) : (investment.customDetails?.weight !== undefined ? Number(investment.customDetails.weight) : undefined),
        purity: investment.purity || investment.customDetails?.purity || undefined,
        goldType: investment.goldType || undefined,
        schemeName: investment.schemeName || investment.customDetails?.fundName || undefined,
        units: investment.units !== undefined ? Number(investment.units) : (investment.customDetails?.units !== undefined ? Number(investment.customDetails.units) : undefined),
        symbol: investment.symbol || investment.customDetails?.ticker || undefined,
        companyName: investment.companyName || undefined,
        quantity: investment.quantity !== undefined ? Number(investment.quantity) : (investment.customDetails?.quantity !== undefined ? Number(investment.customDetails.quantity) : undefined),
        purchasePrice: investment.purchasePrice !== undefined ? Number(investment.purchasePrice) : (investment.customDetails?.purchasePrice !== undefined ? Number(investment.customDetails.purchasePrice) : undefined),
        customDetails: investment.customDetails || undefined,
        autoPay: investment.autoPay || undefined,
        category: investment.category || undefined,
        description: investment.description || undefined,
        reminder: investment.reminder || undefined,
        maturityReminder: investment.maturityReminder || undefined,
        afterMaturityAction: investment.afterMaturityAction || "MANUAL_DECIDE",
        afterMaturityDetails: investment.afterMaturityDetails || {},
      };

      const response = await fetch("http://localhost:5000/api/investments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(investmentData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "INSUFFICIENT_FUNDS") {
          showInsufficientFundsModal({
            availableAmount: data.availableAmount,
            requestedAmount: data.requestedAmount,
            message: data.message,
          });
          return {
            success: false,
            code: "INSUFFICIENT_FUNDS",
            ...data,
          };
        }
        throw new Error(data.message || "Failed to save investment.");
      }

      const savedInvestment = {
        ...data.investment,
        id: data.investment._id,
        amount: Number(data.investment.amount || 0),
        currentValue: Number(data.investment.amount || 0),
        monthlyContribution: Number(data.investment.monthlyContribution || 0),
        totalInterestReceived: Number(data.investment.totalInterestReceived || 0),
        sipContributions: Array.isArray(data.investment.sipContributions) ? data.investment.sipContributions : [],
        afterMaturityAction: data.investment.afterMaturityAction || investment.afterMaturityAction || "MANUAL_DECIDE",
        afterMaturityDetails: data.investment.afterMaturityDetails || investment.afterMaturityDetails || {},
      };

      setInvestments((current) => [...current, savedInvestment]);

      return {
        success: true,
        message: "Investment added successfully.",
        investment: savedInvestment,
      };
    } catch (error) {
      console.error("Add Investment:", error);
      return { success: false, message: error.message || "Failed to add investment." };
    }
  };

  // ==========================================================
  // SIP CONTRIBUTIONS
  // ==========================================================

  const getSIPContributions = async (investmentId) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return {
          success: false,
          message: "Authentication token not found.",
          contributions: [],
        };
      }

      const response = await fetch(
        `http://localhost:5000/api/investments/${investmentId}/contributions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch SIP contributions.");
      }

      return {
        success: true,
        contributions: data.contributions || [],
      };
    } catch (error) {
      console.error("Get SIP Contributions:", error);
      return {
        success: false,
        message: error.message || "Failed to fetch SIP contributions.",
        contributions: [],
      };
    }
  };

  const addSIPContribution = async (investmentId, contributionData = {}) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return {
          success: false,
          message: "Authentication token not found.",
        };
      }

      const targetMonthIso = contributionData.selectedMonth || selectedMonth || activeWorkingPeriod.iso;
      const amount = Number(contributionData.amount);

      if (targetMonthIso === activeWorkingPeriod.iso && Number.isFinite(amount) && amount > availableToAllocate) {
        showInsufficientFundsModal({
          availableAmount: availableToAllocate,
          requestedAmount: amount,
        });
        return {
          success: false,
          code: "INSUFFICIENT_FUNDS",
          availableAmount: availableToAllocate,
          requestedAmount: amount,
          message: `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
            availableToAllocate
          )}, but the requested amount is ${formatINR(amount)}.`,
        };
      }

      const payload = {
        ...contributionData,
        selectedMonth: targetMonthIso,
      };

      const response = await fetch(
        `http://localhost:5000/api/investments/${investmentId}/contributions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "INSUFFICIENT_FUNDS") {
          showInsufficientFundsModal({
            availableAmount: data.availableAmount,
            requestedAmount: data.requestedAmount,
            message: data.message,
          });
          return {
            success: false,
            code: "INSUFFICIENT_FUNDS",
            ...data,
          };
        }
        throw new Error(data.message || "Failed to add SIP contribution.");
      }

      await loadInvestments();
      await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);

      return {
        success: true,
        contribution: data.contribution,
        investment: data.investment,
        message: data.message || "SIP contribution recorded successfully.",
      };
    } catch (error) {
      console.error("Add SIP Contribution:", error);
      return {
        success: false,
        message: error.message || "Failed to add SIP contribution.",
      };
    }
  };

  const updateSIPContribution = async (investmentId, contributionId, updates = {}) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return {
          success: false,
          message: "Authentication token not found.",
        };
      }

      const contributionData = { ...updates };
      if (updates.amount !== undefined) {
        contributionData.amount = nonNegative(updates.amount);
      }

      const response = await fetch(
        `http://localhost:5000/api/investments/${investmentId}/contributions/${contributionId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(contributionData),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "INSUFFICIENT_FUNDS") {
          showInsufficientFundsModal({
            availableAmount: data.availableAmount,
            requestedAmount: data.requestedAmount,
            message: data.message,
          });
          return {
            success: false,
            code: "INSUFFICIENT_FUNDS",
            ...data,
          };
        }
        throw new Error(data.message || "Failed to update SIP contribution.");
      }

      await loadInvestments();

      return {
        success: true,
        contribution: data.contribution,
        investment: data.investment,
        message: data.message || "SIP contribution updated successfully.",
      };
    } catch (error) {
      console.error("Update SIP Contribution:", error);
      return {
        success: false,
        message: error.message || "Failed to update SIP contribution.",
      };
    }
  };

  const addInvestmentTransaction = async (investmentId, transactionData = {}) => {
    try {
      const token = getAuthToken();
      if (!token) {
        return { success: false, message: "Authentication token not found." };
      }

      const amount = Number(transactionData.amount);
      const type = transactionData.type || "Buy";
      const isOutflow = type === "Buy" || type === "Additional Investment";

      if (isOutflow && Number.isFinite(amount) && amount > availableToAllocate) {
        showInsufficientFundsModal({
          availableAmount: availableToAllocate,
          requestedAmount: amount,
        });
        return {
          success: false,
          code: "INSUFFICIENT_FUNDS",
          availableAmount: availableToAllocate,
          requestedAmount: amount,
          message: `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
            availableToAllocate
          )}, but the requested amount is ${formatINR(amount)}.`,
        };
      }

      const response = await fetch(`http://localhost:5000/api/investments/${investmentId}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transactionData),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (data.code === "INSUFFICIENT_FUNDS") {
          showInsufficientFundsModal({
            availableAmount: data.availableAmount,
            requestedAmount: data.requestedAmount,
            message: data.message,
          });
          return {
            success: false,
            code: "INSUFFICIENT_FUNDS",
            ...data,
          };
        }
        throw new Error(data.message || "Failed to add transaction.");
      }

      await loadInvestments();
      await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);

      return {
        success: true,
        investment: data.investment,
        message: data.message || "Transaction recorded successfully.",
      };
    } catch (error) {
      console.error("Add Investment Transaction:", error);
      return { success: false, message: error.message || "Failed to add transaction." };
    }
  };

  const updateInvestment = async (id, updates = {}) => {
    try {
      const token = getAuthToken();

      if (!token) {
        return { success: false, message: "Authentication token not found." };
      }

      const investmentData = {
        ...updates,
        ...(updates.amount !== undefined && { amount: nonNegative(updates.amount) }),
        ...(updates.currentValue !== undefined && { currentValue: nonNegative(updates.currentValue) }),
        ...(updates.monthlyContribution !== undefined && {
          monthlyContribution: nonNegative(updates.monthlyContribution),
        }),
      };

      const response = await fetch(`http://localhost:5000/api/investments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(investmentData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update investment.");
      }

      const updatedInvestment = {
        ...data.investment,
        id: data.investment._id,
        amount: Number(data.investment.amount || 0),
        currentValue: Number(data.investment.currentValue ?? data.investment.amount ?? 0),
        monthlyContribution: Number(data.investment.monthlyContribution || 0),
        totalInterestReceived: Number(data.investment.totalInterestReceived || 0),
        sipContributions: Array.isArray(data.investment.sipContributions) ? data.investment.sipContributions : [],
      };

      setInvestments((current) =>
        current.map((investment) => (investment.id === id ? updatedInvestment : investment))
      );

      return {
        success: true,
        message: "Investment updated successfully.",
        investment: updatedInvestment,
      };
    } catch (error) {
      console.error("Update Investment:", error);
      return { success: false, message: error.message || "Failed to update investment." };
    }
  };

  const updateInvestmentStatus = async (id, status) => {
    try {
      const result = await updateInvestment(id, { status });

      if (!result?.success) {
        return {
          success: false,
          message: result?.message || "Failed to update investment status.",
        };
      }

      return {
        success: true,
        message: `Investment status changed to ${status}.`,
        investment: result.investment,
      };
    } catch (error) {
      console.error("Update Investment Status:", error);
      return {
        success: false,
        message: error.message || "Failed to update investment status.",
      };
    }
  };

  const deleteInvestment = async (id) => {
    try {
      const investmentId = id;
      if (!investmentId) return { success: false, message: "Invalid investment ID." };

      const token = getAuthToken();

      if (!token) return { success: false, message: "Authentication token not found." };

      const response = await fetch(`http://localhost:5000/api/investments/${investmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete investment.");
      }

      setInvestments((current) =>
        current.filter(
          (investment) =>
            String(investment.id ?? investment._id) !== String(investmentId)
        )
      );

      setAdditionalIncomeTransactions((current) =>
        current.filter((transaction) => Number(transaction.investmentId) !== investmentId)
      );

      return { success: true, message: "Investment deleted successfully." };
    } catch (error) {
      console.error("Delete Investment:", error);
      return { success: false, message: error.message || "Failed to delete investment." };
    }
  };

  const getInvestmentMaturityValue = (investment) => {
    if (!investment) return 0;
    const isFD = String(investment.type || "").trim().toLowerCase() === "fixed deposit";
    const interestMethod = String(investment.interestMethod || "").trim().toLowerCase();

    if (isFD && interestMethod === "cumulative") {
      return nonNegative(
        firstDefined(
          investment.maturityAmount,
          investment.estimatedMaturityAmount,
          investment.currentValue,
          investment.amount
        )
      );
    }

    if (isFD) {
      return nonNegative(
        firstDefined(investment.maturityAmount, investment.principalAmount, investment.amount)
      );
    }

    return nonNegative(
      firstDefined(investment.maturityAmount, investment.currentValue, investment.amount)
    );
  };

  const handleInvestmentMaturity = async (id, action = "mature") => {
    try {
      const investment = investments.find((item) => item.id === id);
      if (!investment) return { success: false, message: "Investment not found." };

      const normalizedAction = String(action).trim().toLowerCase();
      const maturityValue = getInvestmentMaturityValue(investment);

      if (normalizedAction === "mature") {
        const result = await updateInvestment(id, {
          status: "Matured",
          monthlyContribution: 0,
        });

        if (!result?.success) return result;

        setInvestments((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "Matured",
                  monthlyContribution: 0,
                  maturedAt: new Date().toISOString(),
                  maturityValue,
                  currentValue: maturityValue,
                }
              : item
          )
        );

        return {
          success: true,
          message: "Investment marked as matured.",
          investment: result.investment,
        };
      }

      if (normalizedAction === "close") {
        const result = await updateInvestment(id, {
          status: "Closed",
          monthlyContribution: 0,
        });

        if (!result?.success) return result;

        setInvestments((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "Closed",
                  monthlyContribution: 0,
                  closedAt: new Date().toISOString(),
                  currentValue: 0,
                }
              : item
          )
        );

        return {
          success: true,
          message: "Investment closed successfully.",
          investment: result.investment,
        };
      }

      return { success: false, message: "Invalid investment maturity action." };
    } catch (error) {
      console.error("Handle Investment Maturity:", error);
      return { success: false, message: error.message || "Failed to update investment maturity status." };
    }
  };

  const recordInvestmentMaturity = async (id, payload = {}) => {
    try {
      const token = getAuthToken();

      if (!token) return { success: false, message: "Authentication token not found." };

      const response = await fetch(`http://localhost:5000/api/investments/${id}/maturity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to record investment maturity.");
      }

      if (data.investment) {
        setInvestments((current) =>
          current.map((item) =>
            String(item.id ?? item._id) === String(id)
              ? {
                  ...item,
                  ...data.investment,
                  id: item.id || data.investment._id,
                }
              : item
          )
        );
      }

      return {
        success: true,
        message: data.message || "Investment maturity recorded successfully.",
        investment: data.investment,
      };
    } catch (error) {
      console.error("Record Investment Maturity:", error);
      return { success: false, message: error.message || "Failed to record investment maturity." };
    }
  };

  const getInvestmentMaturityAllocations = async (id) => {
    try {
      const token = getAuthToken();

      if (!token) return { success: false, message: "Authentication token not found." };

      const response = await fetch(`http://localhost:5000/api/investments/${id}/maturity-allocations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch maturity allocations.");
      }

      return data;
    } catch (error) {
      console.error("Get Investment Maturity Allocations:", error);
      return { success: false, message: error.message || "Failed to fetch allocations." };
    }
  };

  const submitInvestmentMaturityAction = async (id, maturityData) => {
    try {
      const token = getAuthToken();

      if (!token) return { success: false, message: "Authentication token not found." };

      const response = await fetch(`http://localhost:5000/api/investments/${id}/maturity-action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(maturityData),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to process maturity action.");
      }

      // Update the matured investment in state
      if (data.investment) {
        setInvestments((current) =>
          current.map((item) =>
            String(item.id ?? item._id) === String(id)
              ? {
                  ...item,
                  ...data.investment,
                  id: item.id || data.investment._id,
                }
              : item
          )
        );
      }

      // If a new investment was created (via NEW_INVESTMENT, RENEW_FULL, RENEW_PARTIAL), add it to state
      if (data.newInvestment) {
        setInvestments((current) => [
          ...current,
          {
            ...data.newInvestment,
            id: data.newInvestment._id || data.newInvestment.id,
          },
        ]);
      }

      // If a liability was paid, update it in state
      if (data.liability) {
        setLiabilities((current) =>
          current.map((l) =>
            String(l._id ?? l.id) === String(data.liability._id ?? data.liability.id)
              ? {
                  ...l,
                  ...data.liability,
                  id: l.id || data.liability._id,
                }
              : l
          )
        );
      }

      // If KEEP_CASH was chosen, an AdditionalIncome was created!
      // Immediately refresh month finance and monthly history so Available to Allocate updates right away!
      if (data.additionalIncome || maturityData.actionType === "KEEP_CASH") {
        if (data.additionalIncome) {
          setAdditionalIncomeTransactions((current) => [
            ...current,
            {
              ...data.additionalIncome,
              id: data.additionalIncome._id || data.additionalIncome.id,
            },
          ]);
        }
        await loadMonthFinance(monthlyFinance.year, monthlyFinance.month);
        await loadMonthlyHistory();
      }

      return {
        success: true,
        message: data.message || "Maturity action processed successfully.",
        investment: data.investment,
        liability: data.liability,
        newInvestment: data.newInvestment,
        maturityAction: data.maturityAction,
      };
    } catch (error) {
      console.error("Submit Investment Maturity Action:", error);
      return { success: false, message: error.message || "Failed to process maturity action." };
    }
  };

  const renewInvestment = async (id, renewalData = {}) => {
    try {
      const token = getAuthToken();

      if (!token) return { success: false, message: "Authentication token not found." };

      const response = await fetch(`http://localhost:5000/api/investments/${id}/renew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(renewalData),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to renew investment.");
      }

      const renewedInvestment = {
        ...data.investment,
        id: data.investment._id,
        amount: Number(data.investment.amount || 0),
        currentValue: Number(data.investment.currentValue ?? data.investment.amount ?? 0),
        monthlyContribution: Number(data.investment.monthlyContribution || 0),
        totalInterestReceived: Number(data.investment.totalInterestReceived || 0),
        sipContributions: Array.isArray(data.investment.sipContributions) ? data.investment.sipContributions : [],
      };

      if (data.oldInvestment) {
        setInvestments((current) => {
          const updated = current.map((item) =>
            String(item.id ?? item._id) === String(id)
              ? {
                  ...item,
                  ...data.oldInvestment,
                  id: item.id || data.oldInvestment._id,
                }
              : item
          );
          return [...updated, renewedInvestment];
        });
      } else {
        setInvestments((current) => [...current, renewedInvestment]);
      }

      return {
        success: true,
        message: "Investment renewed successfully.",
        investment: renewedInvestment,
        oldInvestment: data.oldInvestment,
      };
    } catch (error) {
      console.error("Renew Investment:", error);
      return { success: false, message: error.message || "Failed to renew investment." };
    }
  };

  // ==========================================================
  // INSURANCE ACTIONS
  // ==========================================================

  const addInsurancePolicy = async (policy = {}) => {
    const token = getAuthToken();

    const newPolicy = {
      ...policy,
      type: policy.type || "Life Insurance",
      name: policy.name,
      policyNumber: policy.policyNumber || "",
      provider: policy.provider || "",
      premiumAmount: nonNegative(policy.premium || policy.premiumAmount),
      premiumFrequency: policy.premiumFrequency || "Yearly",
      coverageAmount: nonNegative(policy.coverageAmount),
      startDate: policy.startDate,
      endDate: policy.endDate,
      maturityDate: policy.maturityDate,
      renewalDate: policy.renewalDate,
      status: policy.status || "Active",
      metadata: policy.metadata || {},
      reminder: policy.reminder || { enabled: false, daysBefore: 7 },
    };

    const response = await fetch("http://localhost:5000/api/insurances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newPolicy),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to save insurance.");
    }

    setInsurancePolicies((current) => [
      ...current,
      {
        ...data.insurance,
        id: data.insurance._id,
        premium: data.insurance.premiumAmount,
        monthlyPremium: data.insurance.premiumAmount, // This might need calculation based on frequency
        monthlyEquivalent: calculateMonthlyEquivalent(data.insurance.premiumAmount, data.insurance.premiumFrequency),
      },
    ]);

    return data.insurance;
  };

  const updateInsurancePolicy = async (id, updates = {}) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/insurances/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update insurance.");
    }

    setInsurancePolicies((current) =>
      current.map((policy) => {
        if (policy.id !== id && policy._id !== id) return policy;
        return {
          ...policy,
          ...data.insurance,
          id: data.insurance._id,
          premium: data.insurance.premiumAmount,
          monthlyEquivalent: calculateMonthlyEquivalent(data.insurance.premiumAmount, data.insurance.premiumFrequency),
        };
      })
    );
  };

  const deleteInsurancePolicy = async (id) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/insurances/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete insurance.");
    }

    setInsurancePolicies((current) => current.filter((policy) => policy.id !== id && policy._id !== id));
  };
  
  function calculateMonthlyEquivalent(amount, frequency) {
    if (!amount) return 0;
    switch (frequency) {
      case "Monthly": return amount;
      case "Quarterly": return amount / 3;
      case "Half-Yearly": return amount / 6;
      case "Yearly": return amount / 12;
      default: return 0;
    }
  }

  const addInsurancePayment = async (id, paymentData) => {
    const token = getAuthToken();

    const targetMonthIso = (typeof paymentData === "object" && paymentData.selectedMonth) || selectedMonth || activeWorkingPeriod.iso;
    const reqAmount = Number(typeof paymentData === "object" ? paymentData.amount : paymentData);

    if (targetMonthIso === activeWorkingPeriod.iso && Number.isFinite(reqAmount) && reqAmount > availableToAllocate) {
      showInsufficientFundsModal({
        availableAmount: availableToAllocate,
        requestedAmount: reqAmount,
      });
      const err = new Error(
        `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
          availableToAllocate
        )}, but the requested amount is ${formatINR(reqAmount)}.`
      );
      err.code = "INSUFFICIENT_FUNDS";
      err.availableAmount = availableToAllocate;
      err.requestedAmount = reqAmount;
      throw err;
    }

    const payload = {
      ...(typeof paymentData === "object" ? paymentData : { amount: paymentData }),
      selectedMonth: targetMonthIso,
    };

    const response = await fetch(`http://localhost:5000/api/insurances/${id}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      if (data.code === "INSUFFICIENT_FUNDS") {
        showInsufficientFundsModal({
          availableAmount: data.availableAmount,
          requestedAmount: data.requestedAmount,
          message: data.message,
        });
        const err = new Error(data.message || "Insufficient funds available.");
        err.code = "INSUFFICIENT_FUNDS";
        err.availableAmount = data.availableAmount;
        err.requestedAmount = data.requestedAmount;
        throw err;
      }
      throw new Error(data.message || "Failed to record payment.");
    }

    setInsurancePolicies((current) =>
      current.map((policy) => {
        if (policy.id !== id && policy._id !== id) return policy;
        return {
          ...policy,
          ...data.insurance,
          id: data.insurance._id,
          premium: data.insurance.premiumAmount,
          monthlyPremium: data.insurance.premiumAmount,
          monthlyEquivalent: calculateMonthlyEquivalent(data.insurance.premiumAmount, data.insurance.premiumFrequency),
        };
      })
    );

    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);

    return data.payment;
  };

  const renewInsurance = async (id, renewalData) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/insurances/${id}/renew`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(renewalData),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to renew insurance.");
    }

    setInsurancePolicies((current) => {
      const updated = current.map((policy) => {
        if (policy.id !== id && policy._id !== id) return policy;
        return {
          ...policy,
          ...data.oldPolicy,
          id: data.oldPolicy._id,
          premium: data.oldPolicy.premiumAmount,
          monthlyPremium: data.oldPolicy.premiumAmount,
          monthlyEquivalent: calculateMonthlyEquivalent(data.oldPolicy.premiumAmount, data.oldPolicy.premiumFrequency),
        };
      });

      return [
        ...updated,
        {
          ...data.insurance,
          id: data.insurance._id,
          premium: data.insurance.premiumAmount,
          monthlyPremium: data.insurance.premiumAmount,
          monthlyEquivalent: calculateMonthlyEquivalent(data.insurance.premiumAmount, data.insurance.premiumFrequency),
        }
      ];
    });

    return data.insurance;
  };

  const recordInsuranceMaturity = async (id, maturityData) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/insurances/${id}/maturity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(maturityData),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to record maturity.");
    }

    setInsurancePolicies((current) =>
      current.map((policy) => {
        if (policy.id !== id && policy._id !== id) return policy;
        return {
          ...policy,
          ...data.insurance,
          id: data.insurance._id,
          premium: data.insurance.premiumAmount,
          monthlyPremium: data.insurance.premiumAmount,
          monthlyEquivalent: calculateMonthlyEquivalent(data.insurance.premiumAmount, data.insurance.premiumFrequency),
        };
      })
    );

    return data.insurance;
  };

  const updateInsuranceStatus = async (id, status) => {
    return updateInsurancePolicy(id, { status });
  };

  // ==========================================================
  // LIABILITY ACTIONS
  // ==========================================================

  const addLiability = async (liability = {}) => {
    const token = getAuthToken();

    const originalAmount = Number(liability.originalAmount || liability.principalAmount || 0);
    const remainingAmount = liability.remainingAmount !== undefined ? Number(liability.remainingAmount) : originalAmount;
    const monthlyEMI = Number(liability.monthlyEMI || 0);

    const payload = {
      ...liability,
      originalAmount,
      remainingAmount,
      monthlyEMI,
      status: liability.status || "Active",
    };

    const response = await fetch("http://localhost:5000/api/liabilities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to save liability.");
    }

    const mapped = {
      ...data.liability,
      id: data.liability._id,
      emi: data.liability.monthlyEMI,
      monthlyPayment: data.liability.monthlyEMI,
    };

    setLiabilities((current) => [...current, mapped]);
    return mapped;
  };

  const updateLiability = async (id, updates = {}) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/liabilities/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to update liability.");
    }

    const mapped = {
      ...data.liability,
      id: data.liability._id,
      emi: data.liability.monthlyEMI,
      monthlyPayment: data.liability.monthlyEMI,
    };

    setLiabilities((current) =>
      current.map((l) => (l.id === id || l._id === id ? mapped : l))
    );

    return mapped;
  };

  const deleteLiability = async (id) => {
    const token = getAuthToken();

    const response = await fetch(`http://localhost:5000/api/liabilities/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to delete liability.");
    }

    setLiabilities((current) => current.filter((l) => l.id !== id && l._id !== id));
  };

  const recordLiabilityPayment = async (id, paymentData = {}) => {
    const token = getAuthToken();

    const baseData = typeof paymentData === "object" ? paymentData : { amount: paymentData };
    const targetMonthIso = baseData.selectedMonth || selectedMonth || activeWorkingPeriod.iso;
    const reqAmount = Number(baseData.amount);

    if (targetMonthIso === activeWorkingPeriod.iso && Number.isFinite(reqAmount) && reqAmount > availableToAllocate) {
      showInsufficientFundsModal({
        availableAmount: availableToAllocate,
        requestedAmount: reqAmount,
      });
      const err = new Error(
        `You don't have sufficient funds available to make this payment. Your available balance is ${formatINR(
          availableToAllocate
        )}, but the requested amount is ${formatINR(reqAmount)}.`
      );
      err.code = "INSUFFICIENT_FUNDS";
      err.availableAmount = availableToAllocate;
      err.requestedAmount = reqAmount;
      throw err;
    }

    const dataPayload = {
      ...baseData,
      selectedMonth: targetMonthIso,
    };

    const response = await fetch(`http://localhost:5000/api/liabilities/${id}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dataPayload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      if (data.code === "INSUFFICIENT_FUNDS") {
        showInsufficientFundsModal({
          availableAmount: data.availableAmount,
          requestedAmount: data.requestedAmount,
          message: data.message,
        });
        const err = new Error(data.message || "Insufficient funds available.");
        err.code = "INSUFFICIENT_FUNDS";
        err.availableAmount = data.availableAmount;
        err.requestedAmount = data.requestedAmount;
        throw err;
      }
      throw new Error(data.message || "Failed to record payment.");
    }

    const mapped = {
      ...data.liability,
      id: data.liability._id,
      emi: data.liability.monthlyEMI,
      monthlyPayment: data.liability.monthlyEMI,
    };

    setLiabilities((current) =>
      current.map((l) => (l.id === id || l._id === id ? mapped : l))
    );

    await loadMonthFinance(activeWorkingPeriod.year, activeWorkingPeriod.month);

    return { success: true, liability: mapped, payment: data.payment };
  };

  const updateLiabilityStatus = async (id, status) => {
    return updateLiability(id, { status });
  };

  // ==========================================================
  // AI ADVISER ACTIONS (GEMINI + MONGODB)
  // ==========================================================

  // Fetch latest stored AI recommendation from MongoDB without calling Gemini
  const fetchLatestAISuggestion = async () => {
    try {
      const token = getAuthToken();
      if (!token) return null;

      const response = await fetch("http://localhost:5000/api/ai/latest", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setLatestAISuggestion(data.data);
        return data.data;
      }
      return null;
    } catch (error) {
      console.error("Fetch Latest AI Suggestion Error:", error);
      return null;
    }
  };

  // Generate new AI recommendation (Gemini/engine + latest MongoDB financial data + live external market data)
  const generateAISuggestion = async (options = {}) => {
    if (aiLoading) {
      console.warn("AI generation already in progress. Ignoring duplicate click.");
      return latestAISuggestion;
    }

    setAiLoading(true);
    setAiLoadingMessage("Refreshing financial and market data...");
    setAiError(null);

    // Progressive transition to phase 2 message
    const phase2Timer = setTimeout(() => {
      setAiLoadingMessage("Analyzing your latest financial position...");
    }, 1100);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("You must be logged in to get AI suggestions.");
      }

      const payload = {
        context: options.context || "plans_commitments",
        targetItem: options.targetItem || null,
        selectedMonth: options.selectedMonth || selectedMonth || undefined,
        ...options,
      };

      const response = await fetch("http://localhost:5000/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "AI analysis is temporarily unavailable. Please try again.");
      }

      setLatestAISuggestion(data.data);
      return data.data;
    } catch (error) {
      console.error("Generate AI Suggestion Error:", error);
      const friendlyMsg = error.message?.toLowerCase().includes("failed to fetch")
        ? "AI analysis is temporarily unavailable. Please check your connection and try again."
        : (error.message || "AI analysis is temporarily unavailable. Please try again.");
      setAiError(friendlyMsg);
      throw error;
    } finally {
      clearTimeout(phase2Timer);
      setAiLoading(false);
      setAiLoadingMessage("Refreshing financial and market data...");
    }
  };

  // Fetch live verified market benchmarks
  const fetchMarketData = async () => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      setMarketDataLoading(true);
      setMarketDataError(null);
      const response = await fetch("http://localhost:5000/api/ai/market-data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setMarketData(data.data);
        return data.data;
      }
      return null;
    } catch (err) {
      console.error("Fetch market data error:", err);
      setMarketDataError(err.message);
      return null;
    } finally {
      setMarketDataLoading(false);
    }
  };

  // Force fresh provider refresh of market benchmarks
  const refreshMarketData = async () => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      setMarketDataLoading(true);
      setMarketDataError(null);
      const response = await fetch("http://localhost:5000/api/ai/market-data/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        setMarketData(data.data);
        return data.data;
      }
      return null;
    } catch (err) {
      console.error("Refresh market data error:", err);
      setMarketDataError(err.message);
      return null;
    } finally {
      setMarketDataLoading(false);
    }
  };

  // ==========================================================
  // ASSETS & NET WORTH COMPUTATIONS
  // ==========================================================

  const totalInvestmentValue = useMemo(
    () => investments.reduce((total, i) => total + getInvestmentCurrentValue(i), 0),
    [investments]
  );

  const totalGoalFundValue = useMemo(
    () => savingGoals.reduce((total, g) => total + getGoalAvailableFund(g), 0),
    [savingGoals]
  );

  const accumulatedMonthlySavings = useMemo(
    () =>
      monthlyHistory.reduce(
        (total, record) =>
          total +
          safeNumber(
            record.savings !== undefined
              ? record.savings
              : safeNumber(record.income) - safeNumber(record.expenses)
          ),
        0
      ),
    [monthlyHistory]
  );

  const cashAllocatedToGoals = totalGoalFundValue;
  const cashAllocatedToInvestments = useMemo(
    () =>
      investments.reduce(
        (total, i) =>
          total + nonNegative(firstDefined(i.principalAmount, i.amount, i.investedAmount)),
        0
      ),
    [investments]
  );

  const currentCashBalance = useMemo(
    () =>
      Math.max(
        nonNegative(cashBalance) +
          accumulatedMonthlySavings -
          cashAllocatedToGoals -
          cashAllocatedToInvestments,
        0
      ),
    [cashBalance, accumulatedMonthlySavings, cashAllocatedToGoals, cashAllocatedToInvestments]
  );

  const totalAssets = useMemo(
    () => currentCashBalance + totalInvestmentValue + totalGoalFundValue,
    [currentCashBalance, totalInvestmentValue, totalGoalFundValue]
  );

  const totalLiabilities = useMemo(
    () => liabilities.reduce((total, l) => total + getLiabilityBalance(l), 0),
    [liabilities]
  );

  const netWorth = useMemo(() => totalAssets - totalLiabilities, [totalAssets, totalLiabilities]);

  const saveNetWorthSnapshot = (snapshotData = {}) => {
    const month = Number(snapshotData.month ?? monthlyFinance.month);
    const year = Number(snapshotData.year ?? monthlyFinance.year);
    const baseIncome = nonNegative(firstDefined(snapshotData.baseIncome, monthlyFinance.income));
    const monthAdditionalIncome =
      snapshotData.additionalIncome !== undefined
        ? nonNegative(snapshotData.additionalIncome)
        : getAdditionalIncomeForMonth(month, year);
    const totalIncome =
      snapshotData.totalIncome !== undefined
        ? nonNegative(snapshotData.totalIncome)
        : baseIncome + monthAdditionalIncome;
    const expenses = nonNegative(firstDefined(snapshotData.expenses, monthlyFinance.expenses));
    const savings =
      snapshotData.savings !== undefined
        ? safeNumber(snapshotData.savings)
        : totalIncome - expenses;

    const snapshotGoalCommitment =
      snapshotData.goalCommitment !== undefined
        ? nonNegative(snapshotData.goalCommitment)
        : goalMonthlyCommitment;
    const snapshotInvestmentCommitment =
      snapshotData.investmentCommitment !== undefined
        ? nonNegative(snapshotData.investmentCommitment)
        : investmentMonthlyCommitment;
    const snapshotInsuranceCommitment =
      snapshotData.insuranceCommitment !== undefined
        ? nonNegative(snapshotData.insuranceCommitment)
        : insuranceMonthlyCommitment;
    const snapshotLiabilityCommitment =
      snapshotData.liabilityCommitment !== undefined
        ? nonNegative(snapshotData.liabilityCommitment)
        : liabilityMonthlyCommitment;
    const snapshotTotalCommitments =
      snapshotData.totalCommitments !== undefined
        ? nonNegative(snapshotData.totalCommitments)
        : snapshotGoalCommitment +
          snapshotInvestmentCommitment +
          snapshotInsuranceCommitment +
          snapshotLiabilityCommitment;

    const snapshotAssets =
      snapshotData.totalAssets !== undefined ? nonNegative(snapshotData.totalAssets) : totalAssets;
    const snapshotLiabilities =
      snapshotData.totalLiabilities !== undefined
        ? nonNegative(snapshotData.totalLiabilities)
        : totalLiabilities;
    const snapshotNetWorth = snapshotAssets - snapshotLiabilities;

    const snapshot = {
      id: snapshotData.id || createId("snapshot"),
      month,
      year,
      baseIncome,
      additionalIncome: monthAdditionalIncome,
      totalIncome,
      income: totalIncome,
      expenses,
      savings,
      goalCommitment: snapshotGoalCommitment,
      investmentCommitment: snapshotInvestmentCommitment,
      insuranceCommitment: snapshotInsuranceCommitment,
      liabilityCommitment: snapshotLiabilityCommitment,
      totalCommitments: snapshotTotalCommitments,
      availableToAllocate:
        snapshotData.availableToAllocate !== undefined
          ? safeNumber(snapshotData.availableToAllocate)
          : cashBalance + savings - snapshotTotalCommitments,
      totalAssets: snapshotAssets,
      totalLiabilities: snapshotLiabilities,
      netWorth: snapshotNetWorth,
      createdAt: snapshotData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setNetWorthSnapshots((current) => {
      const existingIndex = current.findIndex(
        (item) => Number(item.month) === month && Number(item.year) === year
      );
      let updated;
      if (existingIndex !== -1) {
        updated = current.map((item, index) =>
          index === existingIndex ? { ...item, ...snapshot, id: item.id || snapshot.id } : item
        );
      } else {
        updated = [...current, snapshot];
      }
      try {
        localStorage.setItem("financeos_networth_snapshots", JSON.stringify(updated));
      } catch (e) {
        console.warn("Unable to persist net worth snapshots:", e);
      }
      return updated;
    });

    return snapshot;
  };

  // ==========================================================
  // FD CALCULATION HELPERS
  // ==========================================================

  const calculateFDAnnualInterest = (investment) => {
    if (!investment) return 0;
    const principal = nonNegative(firstDefined(investment.principalAmount, investment.amount));
    const rate = nonNegative(investment.interestRate);
    return (principal * rate) / 100;
  };

  const calculateFDInterestPerPayout = (investment) => {
    const annualInterest = calculateFDAnnualInterest(investment);
    const frequency = String(investment?.interestPayoutFrequency || "").trim().toLowerCase();

    if (frequency === "monthly") return annualInterest / 12;
    if (frequency === "quarterly") return annualInterest / 4;
    if (["half yearly", "half-yearly", "halfyearly"].includes(frequency)) return annualInterest / 2;
    return annualInterest;
  };

  const totalFDInterestReceived = useMemo(
    () =>
      additionalIncomeTransactions
        .filter((t) => String(t.type || "").trim().toLowerCase() === "fd interest")
        .reduce((total, t) => total + safeNumber(t.amount), 0),
    [additionalIncomeTransactions]
  );

  // ==========================================================
  // FINANCIAL HEALTH METRICS
  // ==========================================================

  const savingsRate = useMemo(
    () => (totalMonthlyIncome > 0 ? (monthlySavings / totalMonthlyIncome) * 100 : 0),
    [monthlySavings, totalMonthlyIncome]
  );

  const expenseRatio = useMemo(
    () =>
      totalMonthlyIncome > 0
        ? (nonNegative(monthlyFinance.expenses) / totalMonthlyIncome) * 100
        : 0,
    [monthlyFinance.expenses, totalMonthlyIncome]
  );

  const commitmentRatio = useMemo(
    () => (totalMonthlyIncome > 0 ? (totalMonthlyCommitments / totalMonthlyIncome) * 100 : 0),
    [totalMonthlyCommitments, totalMonthlyIncome]
  );

  const financialHealthScore = useMemo(() => {
    if (totalMonthlyIncome <= 0) return 0;
    let score = 100;

    if (expenseRatio > 80) score -= 35;
    else if (expenseRatio > 70) score -= 25;
    else if (expenseRatio > 60) score -= 15;
    else if (expenseRatio > 50) score -= 8;

    if (commitmentRatio > 50) score -= 30;
    else if (commitmentRatio > 40) score -= 20;
    else if (commitmentRatio > 30) score -= 12;
    else if (commitmentRatio > 20) score -= 5;

    if (savingsRate < 0) score -= 35;
    else if (savingsRate < 10) score -= 20;
    else if (savingsRate < 20) score -= 10;
    else if (savingsRate >= 30) score += 5;

    if (availableToAllocate < 0) score -= 20;

    return Math.min(Math.max(Math.round(score), 0), 100);
  }, [totalMonthlyIncome, expenseRatio, commitmentRatio, savingsRate, availableToAllocate]);

  const financialHealthLabel = useMemo(() => {
    if (financialHealthScore >= 80) return "Excellent";
    if (financialHealthScore >= 65) return "Good";
    if (financialHealthScore >= 50) return "Fair";
    if (financialHealthScore >= 35) return "Needs Attention";
    return "High Risk";
  }, [financialHealthScore]);

  const reportYears = useMemo(() => {
    const years = [
      new Date().getFullYear(),
      Number(monthlyFinance.year),
      ...monthlyHistory.map((r) => Number(r.year)),
      ...netWorthSnapshots.map((s) => Number(s.year)),
    ];
    return [...new Set(years.filter((y) => Number.isFinite(y) && y > 0))].sort((a, b) => b - a);
  }, [monthlyFinance.year, monthlyHistory, netWorthSnapshots]);

  // ==========================================================
  // UNIFIED NET WORTH HISTORY (FROM MONGODB HISTORY + SNAPSHOTS)
  // ==========================================================
  const netWorthHistory = useMemo(() => {
    const combinedMap = new Map();

    // 1. Synthesize historical net worth from MongoDB monthly finance records
    (monthlyHistory || []).forEach((record) => {
      const m = Number(record.month);
      const y = Number(record.year);
      if (!m || !y) return;
      const key = `${y}-${String(m).padStart(2, "0")}`;

      const cash = nonNegative(
        record.closingBalance !== undefined
          ? record.closingBalance
          : (record.cashBalance || 0)
      );
      const assets = cash + totalInvestmentValue + totalGoalFundValue;
      const nw = assets - totalLiabilities;

      combinedMap.set(key, {
        id: `derived-${key}`,
        month: m,
        year: y,
        income: record.income || 0,
        expenses: record.expenses || 0,
        savings: record.savings || 0,
        cashBalance: cash,
        totalAssets: assets,
        totalLiabilities,
        netWorth: nw,
        createdAt: record.createdAt || new Date(y, m - 1, 1).toISOString(),
      });
    });

    // 2. Overlay explicit snapshots (higher fidelity if present)
    (netWorthSnapshots || []).forEach((s) => {
      const m = Number(s.month);
      const y = Number(s.year);
      if (!m || !y) return;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      combinedMap.set(key, s);
    });

    // 3. If current month has recorded data, ensure it appears
    if (
      monthlyFinance?.year &&
      monthlyFinance?.month &&
      (monthlyFinance.income > 0 ||
        monthlyFinance.expenses > 0 ||
        monthlyFinance.cashBalance > 0 ||
        monthlyFinance.hasRecord)
    ) {
      const m = Number(monthlyFinance.month);
      const y = Number(monthlyFinance.year);
      const key = `${y}-${String(m).padStart(2, "0")}`;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          id: `current-${key}`,
          month: m,
          year: y,
          income: monthlyFinance.income || 0,
          expenses: monthlyFinance.expenses || 0,
          savings: monthlySavings || 0,
          cashBalance: currentCashBalance,
          totalAssets,
          totalLiabilities,
          netWorth,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return Array.from(combinedMap.values()).sort((a, b) => {
      const keyA = Number(a.year) * 12 + Number(a.month);
      const keyB = Number(b.year) * 12 + Number(b.month);
      return keyA - keyB;
    });
  }, [
    netWorthSnapshots,
    monthlyHistory,
    monthlyFinance,
    monthlySavings,
    currentCashBalance,
    totalAssets,
    totalLiabilities,
    netWorth,
    totalInvestmentValue,
    totalGoalFundValue,
  ]);

  // ==========================================================
  // ==========================================================
  // NOTIFICATIONS & USER-SCOPED READ PERSISTENCE
  // ==========================================================

  const getUserReadNotificationIds = (userId) => {
    if (!userId) return new Set();
    try {
      const stored = localStorage.getItem(`financeos_read_notifications_${userId}`);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  };

  const saveUserReadNotificationId = (userId, id) => {
    if (!userId || !id) return;
    try {
      const existing = getUserReadNotificationIds(userId);
      existing.add(id);
      localStorage.setItem(`financeos_read_notifications_${userId}`, JSON.stringify(Array.from(existing)));
    } catch (e) {
      console.warn("Failed to persist read notification id:", e);
    }
  };

  const saveUserReadNotificationIds = (userId, ids = []) => {
    if (!userId || !Array.isArray(ids) || ids.length === 0) return;
    try {
      const existing = getUserReadNotificationIds(userId);
      ids.forEach((id) => existing.add(id));
      localStorage.setItem(`financeos_read_notifications_${userId}`, JSON.stringify(Array.from(existing)));
    } catch (e) {
      console.warn("Failed to persist read notification ids:", e);
    }
  };

  const addNotification = (notificationData = {}) => {
    const currentUserId = userData?._id || userData?.id || userData?.userId;
    const notifId = notificationData.id || createId("notification");
    const readIds = getUserReadNotificationIds(currentUserId);
    const isAlreadyRead = Boolean(notificationData.read) || readIds.has(notifId);

    const notification = {
      ...notificationData,
      id: notifId,
      userId: notificationData.userId || currentUserId || null,
      type: notificationData.type || "general",
      category: notificationData.category || "System",
      title: notificationData.title || "Notification",
      message: notificationData.message || "",
      source: notificationData.source || "system",
      sourceId: notificationData.sourceId || null,
      date: notificationData.date || new Date().toISOString(),
      read: isAlreadyRead,
      createdAt: notificationData.createdAt || new Date().toISOString(),
    };

    setNotifications((current) => {
      const existingIndex = current.findIndex((item) => item.id === notification.id);
      if (existingIndex !== -1) {
        // If already marked read in state or local storage, preserve read = true
        if (current[existingIndex].read || isAlreadyRead) {
          if (!current[existingIndex].read) {
            const copy = [...current];
            copy[existingIndex] = { ...copy[existingIndex], read: true };
            return copy;
          }
          return current;
        }
        return current;
      }
      return [notification, ...current];
    });

    return notification;
  };

  const markNotificationAsRead = async (id) => {
    const currentUserId = userData?._id || userData?.id || userData?.userId;
    saveUserReadNotificationId(currentUserId, id);

    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    const token = getAuthToken();

    if (String(id).startsWith("msg-")) {
      try {
        if (token) {
          await fetch(`http://localhost:5000/api/messages/${id}/read`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        console.error("Failed to mark message read on backend:", err);
      }
    } else if (String(id).startsWith("reminder-")) {
      try {
        const rawId = String(id).replace(/^reminder-/, "");
        if (token && rawId) {
          await fetch(`http://localhost:5000/api/reminders/${rawId}/read`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        console.error("Failed to mark reminder read on backend:", err);
      }
    }
  };

  const markAllNotificationsAsRead = async (targetIds = null) => {
    const currentUserId = userData?._id || userData?.id || userData?.userId;
    const idsToMark = Array.isArray(targetIds) && targetIds.length > 0
      ? targetIds
      : notifications.map((n) => n.id);

    saveUserReadNotificationIds(currentUserId, idsToMark);

    setNotifications((current) =>
      current.map((n) =>
        idsToMark.includes(n.id) ? { ...n, read: true } : n
      )
    );

    try {
      const token = getAuthToken();
      if (token) {
        await Promise.allSettled([
          fetch(`http://localhost:5000/api/messages/mark-all-read`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`http://localhost:5000/api/reminders/mark-all-read`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);
      }
    } catch (err) {
      console.error("Failed to mark all messages/reminders read on backend:", err);
    }
  };

  const deleteNotification = (id) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  };

  const clearNotifications = () => setNotifications([]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  const value = {
    userData,
    setUserData,

    // Selected Dashboard View Month
    selectedMonth,
    setSelectedMonth,

    // Monthly Finance
    monthlyFinance,
    updateMonthlyFinance,
    loadMonthFinance,
    loadCurrentMonthFinance,
    loadMonthlyHistory,
    monthlyHistory,
    openingBalance,
    closingBalance,
    baseMonthlyIncome,
    additionalIncome,
    totalMonthlyIncome,
    monthlySavings,
    availableToAllocate,
    insufficientFundsModal,
    showInsufficientFundsModal,
    handleInsufficientFundsClose,
    addInvestmentTransaction,

    // Additional Income
    additionalIncomeTransactions,
    recordAdditionalIncome,
    deleteAdditionalIncomeTransaction,
    getAdditionalIncomeForMonth,

    // FD
    recordFDInterest,
    calculateFDAnnualInterest,
    calculateFDInterestPerPayout,
    totalFDInterestReceived,

    // Cash
    cashBalance,
    updateCashBalance,
    accumulatedMonthlySavings,
    currentCashBalance,

    // Saving Goals
    savingGoals,
    visibleSavingGoals,
    activeSavingGoals,
    addSavingGoal,
    updateSavingGoal,
    deleteSavingGoal,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
    withdrawGoalFunds,
    settleSavingGoal,
    updateGoalFundLocation,
    goalMonthlyCommitment,

    // Investments
    investments,
    visibleInvestments,
    activeInvestments,
    addInvestment,
    updateInvestment,
    updateInvestmentStatus,
    deleteInvestment,

    // SIP Contributions
    getSIPContributions,
    addSIPContribution,
    updateSIPContribution,

    // Investment Maturity
    handleInvestmentMaturity,
    recordInvestmentMaturity,
    getInvestmentMaturityAllocations,
    renewInvestment,
    submitInvestmentMaturityAction,
    getInvestmentMaturityValue,

    investmentMonthlyCommitment,
    totalInvestmentValue,

    // Insurance
    insurancePolicies,
    visibleInsurancePolicies,
    activeInsurancePolicies,
    addInsurancePolicy,
    updateInsurancePolicy,
    deleteInsurancePolicy,
    insuranceMonthlyCommitment,
    addInsurancePayment,
    renewInsurance,
    recordInsuranceMaturity,
    updateInsuranceStatus,

    // Liabilities
    liabilities,
    visibleLiabilities,
    activeLiabilities,
    addLiability,
    updateLiability,
    deleteLiability,
    recordLiabilityPayment,
    liabilityMonthlyCommitment,
    updateLiabilityStatus,

    // Commitments & Outflows
    totalMonthlyCommitments,
    totalActualOutflowCommitments,
    totalPlannedMonthlyCommitments,
    actualInvestmentOutflow,
    actualGoalOutflow,
    actualInsuranceOutflow,
    actualLiabilityOutflow,
    cashFlowBreakdown,

    // Assets / Liabilities / Net Worth
    totalGoalFundValue,
    totalAssets,
    totalLiabilities,
    totalOutstandingLiabilities: totalLiabilities,
    totalCashSavings: currentCashBalance,
    netWorth,

    // Reports
    netWorthSnapshots,
    netWorthHistory,
    saveNetWorthSnapshot,
    reportYears,

    // Financial Health
    savingsRate,
    expenseRatio,
    commitmentRatio,
    financialHealthScore,
    financialHealthLabel,

    // Notifications
    notifications,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearNotifications,
    unreadNotificationCount,

    // User Messages & Reminders
    userMessages,
    loadUserMessages,
    userReminders,
    loadUserReminders,
    updateItemReminder,
    disableItemReminder,
    enableItemReminder,
    deleteItemReminder,
    createCustomReminder,
    updateCustomReminder,
    toggleCustomReminder,
    deleteCustomReminder,

    // Sidebar UI State
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebar,

    // AI Adviser
    latestAISuggestion,
    aiLoading,
    aiLoadingMessage,
    aiError,
    fetchLatestAISuggestion,
    generateAISuggestion,
    marketData,
    marketDataLoading,
    marketDataError,
    socketConnected,
    marketDataLastReceived,
    fetchMarketData,
    refreshMarketData,
  };

  return (
    <FinanceContext.Provider value={value}>
      {children}
      <CenteredModal
        isOpen={insufficientFundsModal.isOpen}
        onClose={handleInsufficientFundsClose}
        title="Insufficient Funds"
        message={insufficientFundsModal.message}
        confirmText="OK"
        confirmVariant="primary"
        iconType="error"
        type="alert"
        onConfirm={handleInsufficientFundsClose}
      />
      <CenteredModal
        isOpen={accountDeletedModalOpen}
        onClose={handleAccountDeletedRedirect}
        title="Account Deleted"
        message="Your FinanceOS account has been deleted by an administrator. Please create a new account to continue."
        confirmText="Go to Sign In"
        confirmVariant="danger"
        iconType="error"
        type="alert"
        onConfirm={handleAccountDeletedRedirect}
      />
    </FinanceContext.Provider>
  );
}

export default FinanceProvider;