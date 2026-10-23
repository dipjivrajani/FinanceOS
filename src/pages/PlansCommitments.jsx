// ============================================================
// FINANCEOS - PLANS & COMMITMENTS
// ============================================================
//
// Handles:
// 1. Investments
// 2. Insurance Policies
// 3. Liabilities
// 4. Fixed Deposit Interest
//
// ============================================================

import { useState, useMemo } from "react";

import {
  FiTrendingUp,
  FiShield,
  FiCreditCard,
  FiPlus,
  FiCalendar,
  FiPause,
  FiPlay,
  FiTrash2,
  FiCheckCircle,
  FiDollarSign,
  FiX,
  FiRefreshCw,
  FiShoppingBag,
  FiBarChart2,
  FiZap,
  FiList,
  FiEye,
  FiAlertTriangle,
  FiClock,
  FiLock,
  FiLayers,
  FiArrowRight,
  FiCheck,
  FiInfo,
  FiEdit2,
  FiBell,
} from "react-icons/fi";
import { calculateDueDateForMonth, formatDateISO, formatDateDisplay } from "../utils/dueDateSchedule.js";


// ============================================================
// LAYOUT
// ============================================================

import Sidebar from "../components/layout/Sidebar.jsx";
import Topbar from "../components/layout/Topbar.jsx";


// ============================================================
// FORMS
// ============================================================

import PlanTypeSelector
  from "../components/plansCommitments/PlanTypeSelector.jsx";

import InvestmentForm
  from "../components/plansCommitments/InvestmentForm.jsx";

import InsuranceForm
  from "../components/plansCommitments/InsuranceForm.jsx";

import InsuranceDetailsModal
  from "../components/plansCommitments/InsuranceDetailsModal.jsx";

import LiabilityForm
  from "../components/plansCommitments/LiabilityForm.jsx";

import LiabilityDetailsModal
  from "../components/plansCommitments/LiabilityDetailsModal.jsx";

import FDInterestModal
  from "../components/plansCommitments/FDInterestModal.jsx";

import SIPContributionModal
  from "../components/plansCommitments/SIPContributionModal.jsx";

import ReminderConfigModal
  from "../components/reminders/ReminderConfigModal.jsx";
import CenteredModal
  from "../components/common/CenteredModal.jsx";


// ============================================================
// CONTEXT
// ============================================================

import useFinance from "../context/useFinance.js";
import { AISuggestionDetailsModal } from "../components/dashboard/FinancialSuggestions.jsx";
import { isItemActiveInMonth, parseSelectedMonth } from "../utils/monthLifecycle.js";


// ============================================================
// MAIN COMPONENT
// ============================================================

function PlansCommitments() {

  // ==========================================================
  // CONTEXT
  // ==========================================================

  const {
    investments,
    insurancePolicies,
    liabilities,

    updateInvestmentStatus,
    deleteInvestment,
    renewInvestment,
    recordInvestmentMaturity,
    getInvestmentMaturityAllocations,
    submitInvestmentMaturityAction,

    updateInsuranceStatus,
    deleteInsurancePolicy,

    recordLiabilityPayment,
    updateLiabilityStatus,
    deleteLiability,
    selectedMonth,
    sidebarCollapsed,

    // AI Adviser
    latestAISuggestion,
    aiLoading,
    aiLoadingMessage,
    aiError,
    generateAISuggestion,
  } = useFinance();

  // ==========================================================
  // AI ADVISER HANDLER & MODAL STATE
  // ==========================================================

  const [isAISuggestionModalOpen, setIsAISuggestionModalOpen] = useState(false);

  const handleGetAISuggestion = async () => {
    try {
      const suggestion = await generateAISuggestion({
        context: "plans_commitments",
        selectedMonth: selectedMonth || undefined,
        targetItem: maturityInvestment
          ? {
              id: maturityInvestment.id || maturityInvestment._id,
              name: maturityInvestment.name,
              type: maturityInvestment.type,
              amount:
                maturityInvestment.estimatedMaturityAmount ||
                maturityInvestment.principalAmount ||
                maturityInvestment.amount ||
                0,
            }
          : null,
      });
      if (suggestion) {
        setIsAISuggestionModalOpen(true);
      }
    } catch (err) {
      console.error("AI Suggestion error:", err);
    }
  };

  // ==========================================================
  // SAFE ARRAYS
  // ==========================================================

  const investmentList =
    Array.isArray(investments)
      ? investments
      : [];

  const insuranceList =
    Array.isArray(insurancePolicies)
      ? insurancePolicies
      : [];

  const liabilityList =
    Array.isArray(liabilities)
      ? liabilities
      : [];


  // ==========================================================
  // MODAL STATES
  // ==========================================================

  const [
    showTypeSelector,
    setShowTypeSelector,
  ] = useState(false);

  const [
    selectedPlanType,
    setSelectedPlanType,
  ] = useState(null);

  const [
    paymentLiability,
    setPaymentLiability,
  ] = useState(null);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentError,
    setPaymentError,
  ] = useState("");

  // FD selected for recording interest.
  const [
    interestInvestment,
    setInterestInvestment,
  ] = useState(null);

  // SIP selected for recording contribution.
  const [
    sipContributionInvestment,
    setSIPContributionInvestment,
  ] = useState(null);

  const [editingInvestment, setEditingInvestment] = useState(null);

  const [selectedInsurance, setSelectedInsurance] = useState(null);
  const [editingInsurance, setEditingInsurance] = useState(null);

  const selectedInsuranceData = selectedInsurance
    ? (insurancePolicies || []).find((p) => p._id === selectedInsurance._id || p.id === selectedInsurance.id)
    : null;

  const [selectedLiability, setSelectedLiability] = useState(null);
  const [editingLiability, setEditingLiability] = useState(null);

  const selectedLiabilityData = selectedLiability
    ? (liabilities || []).find((l) => l._id === selectedLiability._id || l.id === selectedLiability.id)
    : null;

  const [reminderTarget, setReminderTarget] = useState(null);

  // ==========================================================
  // INVESTMENT MATURITY ACTION
  // ==========================================================

  const [
    maturityInvestment,
    setMaturityInvestment,
  ] = useState(null);

  const [
    renewalMode,
    setRenewalMode,
  ] = useState(null);

  const [
    renewalAmount,
    setRenewalAmount,
  ] = useState("");

  const [
    renewalChangeMode,
    setRenewalChangeMode,
  ] = useState(false);

  const [
    renewalPaymentOption,
    setRenewalPaymentOption,
  ] = useState("same");

  const [
    renewalFrequency,
    setRenewalFrequency,
  ] = useState("");

  const [
    renewalMaturityDate,
    setRenewalMaturityDate,
  ] = useState("");

  const [
    renewalError,
    setRenewalError,
  ] = useState("");

  const [maturityActionType, setMaturityActionType] = useState(null);
  const [maturityActionAmount, setMaturityActionAmount] = useState("");
  const [maturityActionNote, setMaturityActionNote] = useState("");
  const [maturityActionError, setMaturityActionError] = useState("");
  const [maturitySuccessMessage, setMaturitySuccessMessage] = useState("");
  const [maturityAllocationsList, setMaturityAllocationsList] = useState([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);
  const [isSubmittingMaturityAction, setIsSubmittingMaturityAction] = useState(false);

  // Record Actual Maturity Modal states
  const [recordMaturityItem, setRecordMaturityItem] = useState(null);
  const [recordActualMaturityValue, setRecordActualMaturityValue] = useState("");
  const [recordMaturityDate, setRecordMaturityDate] = useState("");
  const [recordMaturityError, setRecordMaturityError] = useState("");
  const [isRecordingMaturity, setIsRecordingMaturity] = useState(false);

  // Destination Specific Form states
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [cashDate, setCashDate] = useState("");
  const [purchaseItemName, setPurchaseItemName] = useState("");
  const [purchaseCategory, setPurchaseCategory] = useState("Electronics");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [newInvestmentType, setNewInvestmentType] = useState("Mutual Fund");
  const [newInvestmentName, setNewInvestmentName] = useState("");
  const [newInvestmentDate, setNewInvestmentDate] = useState("");
  const [newMaturityDate, setNewMaturityDate] = useState("");
  const [selectedLiabilityId, setSelectedLiabilityId] = useState("");
  const [liabilityPaymentDate, setLiabilityPaymentDate] = useState("");
  const [otherDescription, setOtherDescription] = useState("");
  const [otherCategory, setOtherCategory] = useState("Other");
  const [otherDate, setOtherDate] = useState("");

  // ==========================================================
  // ACTIVE WORKING PERIOD & MONTH LIFECYCLE FILTERING
  // ==========================================================

  const activeWorkingPeriod = useMemo(() => {
    return parseSelectedMonth(selectedMonth);
  }, [selectedMonth]);

  const activeInvestments =
    investmentList.filter(
      (investment) =>
        investment.status === "Active" &&
        isItemActiveInMonth(investment, activeWorkingPeriod.year, activeWorkingPeriod.month)
    );

  const activeInsurance =
    insuranceList.filter(
      (policy) =>
        policy.status === "Active" &&
        isItemActiveInMonth(policy, activeWorkingPeriod.year, activeWorkingPeriod.month)
    );

  const activeLiabilities =
    liabilityList.filter(
      (liability) =>
        liability.status === "Active" &&
        isItemActiveInMonth(liability, activeWorkingPeriod.year, activeWorkingPeriod.month)
    );


  // ==========================================================
  // MONTHLY INVESTMENT COMMITMENT
  // ==========================================================

  const monthlyInvestmentCommitment =
    activeInvestments.reduce(
      (total, investment) =>
        total +
        Number(
          investment.monthlyContribution ||
          (investment.type === "SIP" ? investment.amount : 0) ||
          0
        ),
      0
    );


  // ==========================================================
  // MONTHLY INSURANCE COMMITMENT
  // ==========================================================

  const monthlyInsuranceCommitment =
    activeInsurance.reduce(
      (total, policy) =>
        total +
        Number(
          policy.monthlyPremium ||
          0
        ),
      0
    );


  // ==========================================================
  // MONTHLY LIABILITY COMMITMENT
  // ==========================================================

  const monthlyLiabilityCommitment =
    activeLiabilities.reduce(
      (total, liability) =>
        total +
        Number(
          liability.monthlyEMI ||
          0
        ),
      0
    );


  // ==========================================================
  // TOTAL MONTHLY COMMITMENT
  // ==========================================================

  const totalMonthlyCommitments =
    monthlyInvestmentCommitment +
    monthlyInsuranceCommitment +
    monthlyLiabilityCommitment;


  // ==========================================================
  // FORMAT MONEY
  // ==========================================================

  const formatMoney = (amount) =>
    Number(
      amount || 0
    ).toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    );


  // ==========================================================
  // MATURITY AMOUNT FOR DISPLAY & DYNAMIC TRACKING
  // ==========================================================

  const maturityAmountForDisplay =
    maturityInvestment
      ? Number(
          maturityInvestment
            .estimatedMaturityAmount ||
          maturityInvestment
            .principalAmount ||
          maturityInvestment.amount ||
          0
        )
      : 0;

  const currentActualMaturity = maturityInvestment
    ? Number(
        maturityInvestment.actualMaturityValue ||
        maturityInvestment.estimatedMaturityAmount ||
        maturityInvestment.currentValue ||
        maturityInvestment.principalAmount ||
        maturityInvestment.amount ||
        0
      )
    : 0;

  const currentAllocated = maturityInvestment
    ? Number(maturityInvestment.maturityAllocatedAmount || 0)
    : 0;

  const currentRemaining = maturityInvestment
    ? (maturityInvestment.maturityRemainingAmount !== undefined &&
       maturityInvestment.maturityRemainingAmount !== null
        ? Number(maturityInvestment.maturityRemainingAmount)
        : Math.max(0, currentActualMaturity - currentAllocated))
    : 0;

  const isMaturityFullyAllocated = maturityInvestment
    ? ((currentRemaining <= 0 && currentAllocated > 0) ||
       maturityInvestment.maturityAllocationStatus === "Fully Allocated")
    : false;


  // ==========================================================
  // FORMATTED ACTIVE PERIOD
  // ==========================================================

  const formattedPeriod = useMemo(() => {
    const saved =
      selectedMonth ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("financeos_selected_month")
        : "");
    if (saved && /^\d{4}-\d{1,2}$/.test(saved)) {
      const [y, m] = saved.split("-").map(Number);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${months[m - 1]} ${y}`;
    }
    const now = new Date();
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }, [selectedMonth]);

  // ==========================================================
  // PLAN SELECTOR
  // ==========================================================

  const openPlanSelector = () => {

    setSelectedPlanType(null);
    setShowTypeSelector(true);

  };


  const selectPlanType = (type) => {

    setShowTypeSelector(false);
    setSelectedPlanType(type);

  };


  const closeForm = () => {

    setSelectedPlanType(null);

  };


  // ==========================================================
  // COMMON FINANCEOS CENTERED ACTION MODAL SYSTEM
  // ==========================================================

  const [actionModal, setActionModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
    confirmText: "OK",
    cancelText: "Cancel",
    confirmVariant: "primary",
    onConfirm: null,
  });

  const handlePausePlan = (item, type) => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to pause this plan?",
      message: `You are pausing "${item.name || item.policyName || item.title || "this plan"}". You can resume it at any time.`,
      type: "confirm",
      confirmText: "Pause",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          if (type === "investment") {
            await updateInvestmentStatus(item.id || item._id, "Paused");
          } else if (type === "insurance") {
            await updateInsuranceStatus(item.id || item._id, "Paused");
          } else if (type === "liability") {
            await updateLiabilityStatus(item._id || item.id, "Paused");
          }
          setActionModal({
            isOpen: true,
            title: "Plan Paused Successfully",
            message: "The plan has been paused.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to pause the plan. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  const handleResumePlan = (item, type) => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to resume this plan?",
      message: `You are resuming "${item.name || item.policyName || item.title || "this plan"}".`,
      type: "confirm",
      confirmText: "Resume",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          if (type === "investment") {
            await updateInvestmentStatus(item.id || item._id, "Active");
          } else if (type === "insurance") {
            await updateInsuranceStatus(item.id || item._id, "Active");
          } else if (type === "liability") {
            await updateLiabilityStatus(item._id || item.id, "Active");
          }
          setActionModal({
            isOpen: true,
            title: "Plan Resumed Successfully",
            message: "The plan has been resumed.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to resume the plan. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  const handleMarkMatured = (investment) => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to mark this plan as matured?",
      message: `Marking "${investment.name || "this plan"}" as matured will update its lifecycle status.`,
      type: "confirm",
      confirmText: "Mark Matured",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          const res = await updateInvestmentStatus(investment.id || investment._id, "Matured");
          if (!res?.success) throw new Error(res?.message || "Failed to mark matured.");
          setActionModal({
            isOpen: true,
            title: "Plan Marked as Matured",
            message: "The plan status has been updated successfully.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to update the plan. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  const handleCloseLiability = (liability) => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to close this liability?",
      message: `Close "${liability.name}"? Its remaining balance will stay in the record, but it will no longer count as an active monthly commitment.`,
      type: "confirm",
      confirmText: "Close Liability",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          await updateLiabilityStatus(liability._id || liability.id, "Closed");
          setActionModal({
            isOpen: true,
            title: "Liability Closed Successfully",
            message: "The liability has been closed.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to close liability. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // ==========================================================
  // DELETE INVESTMENT
  // ==========================================================

  const handleDeleteInvestment = (investment) => {
    const investmentId = investment?.id ?? investment?._id;

    if (!investmentId) {
      setActionModal({
        isOpen: true,
        title: "Something went wrong",
        message: "Investment ID is missing.",
        type: "error",
        confirmText: "OK",
        onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete?",
      message: "This action cannot be undone.",
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          const result = await deleteInvestment(investmentId);
          if (!result?.success) {
            throw new Error(result?.message || "Failed to delete investment.");
          }
          setActionModal({
            isOpen: true,
            title: "Deleted Successfully",
            message: "The plan has been deleted successfully.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to delete the plan. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // ==========================================================
  // DELETE INSURANCE
  // ==========================================================

  const handleDeleteInsurance = (policy) => {
    const policyId = policy?.id ?? policy?._id;
    if (!policyId) return;

    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete?",
      message: "This action cannot be undone.",
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteInsurancePolicy(policyId);
          setActionModal({
            isOpen: true,
            title: "Deleted Successfully",
            message: "The plan has been deleted successfully.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Unable to delete policy. Please try again.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // ==========================================================
  // DELETE LIABILITY
  // ==========================================================

  const handleDeleteLiability = (liability) => {
    const liabilityId = liability?._id ?? liability?.id;
    if (!liabilityId) return;

    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete?",
      message: "This action cannot be undone.",
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteLiability(liabilityId);
          setActionModal({
            isOpen: true,
            title: "Deleted Successfully",
            message: "The plan has been deleted successfully.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Failed to delete liability.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // ==========================================================
  // FORM SUCCESS HANDLER
  // ==========================================================

  const handleFormSuccess = (options = {}) => {
    closeForm();
    setEditingInvestment(null);
    setEditingInsurance(null);
    setEditingLiability(null);
    setSelectedInsurance(null);
    setSelectedLiability(null);

    const isEdit = Boolean(options?.isEdit);
    setActionModal({
      isOpen: true,
      title: isEdit ? "Updated Successfully" : "Plan Added Successfully",
      message: isEdit ? "Your plan has been updated successfully." : "Your plan has been saved successfully.",
      type: "success",
      confirmText: "OK",
      onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
    });
  };


  // ==========================================================
  // OPEN LIABILITY PAYMENT MODAL
  // ==========================================================

  const openPaymentModal = (
    liability
  ) => {

    setPaymentLiability(
      liability
    );

    setPaymentAmount(
      liability.monthlyEMI
        ? String(
            liability.monthlyEMI
          )
        : ""
    );

    setPaymentError("");

  };


  // ==========================================================
  // CLOSE LIABILITY PAYMENT MODAL
  // ==========================================================

  const closePaymentModal = () => {

    setPaymentLiability(null);
    setPaymentAmount("");
    setPaymentError("");

  };


  // ==========================================================
  // RECORD LIABILITY PAYMENT
  // ==========================================================

  const handleRecordPayment = async (
    event
  ) => {

    event.preventDefault();

    if (!paymentLiability) {
      return;
    }

    const amount =
      Number(
        paymentAmount
      );

    const remaining =
      Number(
        paymentLiability.remainingAmount ||
        0
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      setPaymentError(
        "Enter a valid payment amount."
      );

      return;

    }

    if (remaining <= 0) {

      setPaymentError(
        "This liability has already been completed."
      );

      return;

    }

    try {
      await recordLiabilityPayment(
        paymentLiability._id || paymentLiability.id,
        amount
      );
      closePaymentModal();
      setActionModal({
        isOpen: true,
        title: "Payment Recorded Successfully",
        message: `₹${formatMoney(amount)} has been recorded successfully.`,
        type: "success",
        confirmText: "OK",
        onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
      });
    } catch (err) {
      if (err?.code === "INSUFFICIENT_FUNDS") {
        closePaymentModal();
        return;
      }
      setPaymentError(err.message || "Failed to record payment.");
    }

  };


  // ==========================================================
  // OPEN FD INTEREST MODAL
  // ==========================================================

  const openFDInterestModal = (
    investment
  ) => {

    setInterestInvestment(
      investment
    );

  };


  // ==========================================================
  // CLOSE FD INTEREST MODAL
  // ==========================================================

  const closeFDInterestModal = () => {

    setInterestInvestment(
      null
    );

  };


  // OPEN SIP CONTRIBUTION MODAL
  // ==========================================================

  const openSIPContributionModal = (
    investment
  ) => {
    setSIPContributionInvestment(
      investment
    );
  };


  // ==========================================================
  // CLOSE SIP CONTRIBUTION MODAL
  // ==========================================================

  const closeSIPContributionModal = () => {
    setSIPContributionInvestment(
      null
    );
  };


  // ==========================================================
  // OPEN MATURITY ACTION MODAL
  // ==========================================================

  const openMaturityActionModal = async (investment) => {
    // If actual maturity amount has not been recorded yet (<= 0), prompt to record actual maturity first!
    const actualVal = Number(investment.actualMaturityValue || 0);
    if (actualVal <= 0) {
      openRecordMaturityModal(investment);
      return;
    }

    setMaturityInvestment(investment);
    setMaturityActionType(null);
    setMaturityActionError("");
    setMaturitySuccessMessage("");
    setIsLoadingAllocations(true);

    try {
      const res = await getInvestmentMaturityAllocations(investment.id || investment._id);
      if (res?.success) {
        setMaturityAllocationsList(res.allocations || []);
        if (res.investment) {
          setMaturityInvestment(res.investment);
        }
      }
    } catch (e) {
      console.error("Failed to load allocations", e);
    } finally {
      setIsLoadingAllocations(false);
    }
  };


  // ==========================================================
  // CLOSE MATURITY ACTION MODAL
  // ==========================================================

  const closeMaturityActionModal = () => {
    setMaturityInvestment(null);
    setRenewalMode(null);
    setMaturityActionType(null);
    setMaturityActionError("");
    setMaturitySuccessMessage("");
  };


  // ==========================================================
  // RECORD ACTUAL MATURITY MODAL HANDLERS
  // ==========================================================

  const openRecordMaturityModal = (investment) => {
    setRecordMaturityItem(investment);
    const estimated = Number(
      investment.actualMaturityValue ||
      investment.estimatedMaturityAmount ||
      investment.principalAmount ||
      investment.currentValue ||
      investment.amount ||
      0
    );
    setRecordActualMaturityValue(estimated > 0 ? String(estimated) : "");
    const initialDate = investment.maturityDate
      ? String(investment.maturityDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setRecordMaturityDate(initialDate);
    setRecordMaturityError("");
  };

  const closeRecordMaturityModal = () => {
    setRecordMaturityItem(null);
    setRecordMaturityError("");
  };

  const handleConfirmRecordMaturity = async () => {
    if (!recordMaturityItem) return;
    const numVal = Number(recordActualMaturityValue);
    if (!Number.isFinite(numVal) || numVal <= 0) {
      setRecordMaturityError("Please enter a valid actual received maturity amount greater than 0.");
      return;
    }
    if (!recordMaturityDate) {
      setRecordMaturityError("Please select the maturity date.");
      return;
    }

    setIsRecordingMaturity(true);
    setRecordMaturityError("");

    try {
      const res = await recordInvestmentMaturity(recordMaturityItem.id || recordMaturityItem._id, {
        actualMaturityValue: numVal,
        maturityDate: recordMaturityDate,
      });

      if (!res?.success) {
        setRecordMaturityError(res?.message || "Failed to record maturity.");
        return;
      }

      const updatedInv = res.investment || {
        ...recordMaturityItem,
        actualMaturityValue: numVal,
        status: "Matured",
        maturityRemainingAmount: numVal,
        maturityAllocatedAmount: 0,
        maturityAllocationStatus: "Pending Allocation",
      };

      setRecordMaturityItem(null);
      // Immediately open post-maturity allocation workflow!
      await openMaturityActionModal(updatedInv);
    } catch (err) {
      console.error(err);
      setRecordMaturityError(err.message || "Failed to record maturity.");
    } finally {
      setIsRecordingMaturity(false);
    }
  };


  // ==========================================================
  // OPEN INVESTMENT RENEWAL FORM
  // ==========================================================

  const openRenewalForm = (mode) => {
    if (!maturityInvestment) {
      return;
    }

    const totalMaturity = Number(
      maturityInvestment.actualMaturityValue ||
      maturityInvestment.estimatedMaturityAmount ||
      maturityInvestment.principalAmount ||
      maturityInvestment.amount ||
      0
    );

    const allocated = Number(maturityInvestment.maturityAllocatedAmount || 0);
    const remaining =
      maturityInvestment.maturityRemainingAmount !== undefined &&
      maturityInvestment.maturityRemainingAmount !== null
        ? Number(maturityInvestment.maturityRemainingAmount)
        : Math.max(0, totalMaturity - allocated);

    setRenewalMode(mode);
    setRenewalError("");
    setMaturitySuccessMessage("");

    if (mode === "partial") {
      setRenewalChangeMode(true);
      const suggested = remaining > 1000 ? Math.floor(remaining * 0.5) : Math.max(1, remaining - 1);
      setRenewalAmount(String(suggested));
    } else {
      setRenewalChangeMode(false);
      setRenewalAmount(String(remaining));
    }

    setRenewalPaymentOption("same");
    setRenewalFrequency(maturityInvestment.frequency || "");
    setRenewalMaturityDate(
      maturityInvestment.maturityDate
        ? String(maturityInvestment.maturityDate).slice(0, 10)
        : ""
    );
  };

  // ==========================================================
  // CONFIRM INVESTMENT RENEWAL
  // ==========================================================

  const handleConfirmRenewal = async () => {
    if (!maturityInvestment) {
      return;
    }

    const totalMaturity = Number(
      maturityInvestment.actualMaturityValue ||
      maturityInvestment.estimatedMaturityAmount ||
      maturityInvestment.principalAmount ||
      maturityInvestment.amount ||
      0
    );

    const allocated = Number(maturityInvestment.maturityAllocatedAmount || 0);
    const remaining =
      maturityInvestment.maturityRemainingAmount !== undefined &&
      maturityInvestment.maturityRemainingAmount !== null
        ? Number(maturityInvestment.maturityRemainingAmount)
        : Math.max(0, totalMaturity - allocated);

    const amount = Number(renewalAmount);

    // --------------------------------------------------------
    // VALIDATE RENEWAL AMOUNT
    // --------------------------------------------------------

    if (!Number.isFinite(amount) || amount <= 0) {
      setRenewalError("Enter a valid renewal amount greater than 0.");
      return;
    }

    if (amount > remaining + 0.01) {
      setRenewalError(
        `Renewal amount (₹${Math.round(amount).toLocaleString("en-IN")}) cannot be greater than the remaining maturity amount (₹${Math.round(remaining).toLocaleString("en-IN")}).`
      );
      return;
    }

    if (renewalMode === "partial" && amount >= remaining) {
      setRenewalError(
        `For partial renewal, the amount must be strictly less than remaining (₹${Math.round(remaining).toLocaleString("en-IN")}). Otherwise choose Renew Full Amount.`
      );
      return;
    }

    // --------------------------------------------------------
    // VALIDATE CHANGED MATURITY DATE
    // --------------------------------------------------------

    if (renewalChangeMode && !renewalMaturityDate) {
      setRenewalError("Select the new maturity date.");
      return;
    }

    setRenewalError("");

    // --------------------------------------------------------
    // PAYMENT SETTINGS
    // --------------------------------------------------------

    let contributionType =
      maturityInvestment.contributionType || "One Time";

    let frequency =
      maturityInvestment.frequency || null;

    if (renewalChangeMode) {
      if (renewalPaymentOption === "one-time") {
        contributionType = "One Time";
        frequency = null;
      }
      if (renewalPaymentOption === "recurring") {
        contributionType = "Recurring";
        frequency = renewalFrequency || maturityInvestment.frequency || "Monthly";
      }
    }

    const maturityDate = renewalChangeMode
      ? renewalMaturityDate
      : (maturityInvestment.maturityDate || null);

    const renewalData = {
      amount,
      principalAmount: amount,
      contributionType,
      frequency,
      maturityDate,
      status: "Active",
    };

    try {
      const invId = maturityInvestment.id || maturityInvestment._id;
      const result = await renewInvestment(invId, renewalData);

      if (!result?.success) {
        setRenewalError(result?.message || "Failed to renew investment.");
        return;
      }

      setRenewalMode(null);
      setRenewalChangeMode(false);
      setRenewalAmount("");
      setRenewalPaymentOption("same");
      setRenewalFrequency("");
      setRenewalMaturityDate("");
      setRenewalError("");

      setMaturitySuccessMessage(
        `Successfully renewed ₹${Math.round(amount).toLocaleString("en-IN")} into a new investment!`
      );

      // Refresh ledger & maturity investment state
      const refreshed = await getInvestmentMaturityAllocations(invId);
      if (refreshed?.success) {
        setMaturityAllocationsList(refreshed.allocations || []);
        if (refreshed.investment) {
          setMaturityInvestment(refreshed.investment);
        }
      } else if (result.oldInvestment) {
        setMaturityInvestment(result.oldInvestment);
      }
    } catch (error) {
      console.error("Confirm Renewal:", error);
      setRenewalError(error.message || "Failed to renew investment.");
    }
  };

  // ==========================================================
  // OPEN MATURITY ACTION FORM
  // ==========================================================

  const openMaturityActionForm = (type) => {
    if (!maturityInvestment) return;
    const totalMat = Number(
      maturityInvestment.actualMaturityValue ||
      maturityInvestment.estimatedMaturityAmount ||
      maturityInvestment.amount ||
      0
    );
    const allocated = Number(maturityInvestment.maturityAllocatedAmount || 0);
    const remaining =
      maturityInvestment.maturityRemainingAmount !== undefined &&
      maturityInvestment.maturityRemainingAmount !== null
        ? Number(maturityInvestment.maturityRemainingAmount)
        : Math.max(0, totalMat - allocated);

    setMaturityActionType(type);
    setMaturityActionAmount(String(remaining));
    setMaturityActionNote("");
    setMaturityActionError("");
    setMaturitySuccessMessage("");

    const todayStr = new Date().toISOString().slice(0, 10);
    // Initialize destination defaults
    if (type === "BANK_SAVINGS") {
      setBankName(
        maturityInvestment.afterMaturityDetails?.bankName ||
        maturityInvestment.institution ||
        ""
      );
      setAccountLast4(
        maturityInvestment.afterMaturityDetails?.accountLast4 || ""
      );
    } else if (type === "KEEP_CASH") {
      setCashDate(todayStr);
    } else if (type === "PURCHASE") {
      setPurchaseItemName("");
      setPurchaseCategory("Electronics");
      setPurchaseDate(todayStr);
    } else if (type === "NEW_INVESTMENT") {
      setNewInvestmentType("Mutual Fund");
      setNewInvestmentName(`${maturityInvestment.name} (Reinvested)`);
      setNewInvestmentDate(todayStr);
      setNewMaturityDate("");
    } else if (type === "PAY_LIABILITY") {
      const activeLiabs = (liabilities || []).filter(
        (l) => l.status === "Active" || Number(l.remainingAmount || 0) > 0
      );
      if (activeLiabs.length > 0) {
        setSelectedLiabilityId(String(activeLiabs[0]._id || activeLiabs[0].id));
        const defaultPay = Math.min(remaining, Number(activeLiabs[0].remainingAmount || 0));
        setMaturityActionAmount(String(defaultPay));
      } else {
        setSelectedLiabilityId("");
      }
      setLiabilityPaymentDate(todayStr);
    } else if (type === "OTHER") {
      setOtherDescription("");
      setOtherCategory("Other");
      setOtherDate(todayStr);
    }
  };

  const handleConfirmMaturityAction = async () => {
    if (!maturityInvestment || !maturityActionType) return;
    const actionAmount = Number(maturityActionAmount);
    const totalMat = Number(
      maturityInvestment.actualMaturityValue ||
      maturityInvestment.estimatedMaturityAmount ||
      maturityInvestment.amount ||
      0
    );
    const allocated = Number(maturityInvestment.maturityAllocatedAmount || 0);
    const remaining =
      maturityInvestment.maturityRemainingAmount !== undefined &&
      maturityInvestment.maturityRemainingAmount !== null
        ? Number(maturityInvestment.maturityRemainingAmount)
        : Math.max(0, totalMat - allocated);

    if (!Number.isFinite(actionAmount) || actionAmount <= 0) {
      setMaturityActionError("Please enter a valid amount greater than 0.");
      return;
    }
    if (actionAmount > remaining + 0.01) {
      setMaturityActionError(
        `Action amount (₹${Math.round(actionAmount).toLocaleString("en-IN")}) cannot exceed remaining maturity amount (₹${Math.round(remaining).toLocaleString("en-IN")}).`
      );
      return;
    }

    // Destination-specific validation
    const payload = {
      actionType: maturityActionType,
      actionAmount,
      note: maturityActionNote,
    };

    if (maturityActionType === "BANK_SAVINGS") {
      if (!bankName.trim()) {
        setMaturityActionError("Bank Name is required.");
        return;
      }
      if (!accountLast4.trim() || !/^\d{4}$/.test(accountLast4.trim())) {
        setMaturityActionError("Please enter exactly 4 digits for Account Last 4 Digits.");
        return;
      }
      payload.bankName = bankName.trim();
      payload.accountLast4 = accountLast4.trim();
    } else if (maturityActionType === "KEEP_CASH") {
      payload.actionDate = cashDate || new Date().toISOString();
    } else if (maturityActionType === "PURCHASE") {
      if (!purchaseItemName.trim()) {
        setMaturityActionError("Please specify what you purchased.");
        return;
      }
      payload.itemName = purchaseItemName.trim();
      payload.category = purchaseCategory || "Other";
      payload.actionDate = purchaseDate || new Date().toISOString();
    } else if (maturityActionType === "NEW_INVESTMENT") {
      if (!newInvestmentName.trim()) {
        setMaturityActionError("Investment Name is required.");
        return;
      }
      payload.investmentType = newInvestmentType;
      payload.investmentName = newInvestmentName.trim();
      payload.actionDate = newInvestmentDate || new Date().toISOString();
      if (newMaturityDate) payload.newMaturityDate = newMaturityDate;
    } else if (maturityActionType === "PAY_LIABILITY") {
      if (!selectedLiabilityId) {
        setMaturityActionError("Please select an active liability to pay.");
        return;
      }
      const targetLiab = (liabilities || []).find(
        (l) => String(l._id || l.id) === String(selectedLiabilityId)
      );
      if (!targetLiab) {
        setMaturityActionError("Selected liability not found.");
        return;
      }
      const liabOutstanding = Number(targetLiab.remainingAmount || 0);
      if (actionAmount > liabOutstanding + 0.01) {
        setMaturityActionError(
          `Payment cannot exceed current outstanding liability of ₹${Math.round(liabOutstanding).toLocaleString("en-IN")}.`
        );
        return;
      }
      payload.liabilityId = selectedLiabilityId;
      payload.actionDate = liabilityPaymentDate || new Date().toISOString();
    } else if (maturityActionType === "OTHER") {
      if (!otherDescription.trim()) {
        setMaturityActionError("Please describe how the maturity proceeds were used.");
        return;
      }
      payload.description = otherDescription.trim();
      payload.category = otherCategory;
      payload.actionDate = otherDate || new Date().toISOString();
    }

    setIsSubmittingMaturityAction(true);
    setMaturityActionError("");

    try {
      const result = await submitInvestmentMaturityAction(
        maturityInvestment.id || maturityInvestment._id,
        payload
      );

      if (!result?.success) {
        setMaturityActionError(result?.message || "Failed to process maturity action.");
        return;
      }

      setMaturitySuccessMessage(
        `Successfully allocated ₹${Math.round(actionAmount).toLocaleString("en-IN")} to ${maturityActionType.replace(/_/g, " ").toLowerCase()}!`
      );
      setMaturityActionType(null);

      // Refresh allocations ledger and update state
      const refreshed = await getInvestmentMaturityAllocations(
        maturityInvestment.id || maturityInvestment._id
      );
      if (refreshed?.success) {
        setMaturityAllocationsList(refreshed.allocations || []);
        if (refreshed.investment) {
          setMaturityInvestment(refreshed.investment);
        }
      } else if (result.investment) {
        setMaturityInvestment(result.investment);
      }
    } catch (error) {
      console.error(error);
      setMaturityActionError(error.message || "Failed to process maturity action.");
    } finally {
      setIsSubmittingMaturityAction(false);
    }
  };


  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  const hasNoPlans =
    investmentList.length === 0 &&
    insuranceList.length === 0 &&
    liabilityList.length === 0;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="min-h-screen bg-[#f6f8f4]">

      <Sidebar />


      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>

        <Topbar />


        <div className="px-8 py-6">

          {/* ==================================================
              HEADER
             ================================================== */}

          <div className="flex items-start justify-between gap-6">

            <div>

              <p className="text-sm font-medium text-[#5f7568]">
                FinanceOS
              </p>

              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-2xl font-bold text-[#18392c]">
                  Plans & Commitments
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf6e8] border border-[#d6e8ce] px-3 py-1 text-xs font-bold text-[#315c46]">
                  <FiCalendar size={13} />
                  {formattedPeriod}
                </span>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Track and update your investments,
                insurance policies and liabilities for {formattedPeriod}.
              </p>

            </div>


            <div className="flex items-center gap-3">
              {latestAISuggestion && (
                <button
                  type="button"
                  onClick={() => setIsAISuggestionModalOpen(true)}
                  className="hidden md:flex shrink-0 items-center gap-1.5 rounded-xl border border-[#dfe8dc] bg-[#f7fbf5] px-3.5 py-3 text-sm font-semibold text-[#315c46] transition hover:bg-[#ebf5e7] shadow-xs cursor-pointer"
                  title="Open latest saved financial analysis"
                >
                  <FiZap className="text-[#315c46]" size={15} />
                  <span>View Analysis</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleGetAISuggestion}
                disabled={aiLoading}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-[#315c46] bg-white px-4 py-3 text-sm font-semibold text-[#18392c] transition hover:bg-[#edf6e8] shadow-xs cursor-pointer disabled:opacity-50"
                title="Run Live AI Financial Analysis"
              >
                <FiZap className={`text-base ${aiLoading ? "animate-spin text-amber-600" : "text-[#315c46]"}`} />
                <span>{aiLoading ? (aiLoadingMessage || "Analyzing Situation...") : (latestAISuggestion ? "Re-analyze" : "Get AI Suggestion")}</span>
              </button>

              <button
                type="button"
                onClick={
                  openPlanSelector
                }
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#18392c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244c3b] shadow-xs cursor-pointer"
              >

                <FiPlus />

                Add Plan / Commitment

              </button>
            </div>

          </div>

          {aiError && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-900 shadow-xs">
              <div className="flex items-start gap-2.5">
                <FiAlertTriangle className="mt-0.5 text-rose-600 shrink-0" size={16} />
                <div>
                  <p className="font-bold text-rose-900">AI Financial Analysis Notice</p>
                  <p className="mt-0.5 text-rose-700">{aiError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGetAISuggestion}
                disabled={aiLoading}
                className="shrink-0 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
              >
                Retry Analysis
              </button>
            </div>
          )}


          {/* ==================================================
              TOTAL MONTHLY COMMITMENTS
             ================================================== */}

          <div className="mt-7 rounded-2xl border border-[#dcebd4] bg-[#f4faef] p-5">

            <div className="flex items-center justify-between gap-5">

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                  Monthly Financial Load
                </p>

                <h2 className="mt-1 text-base font-semibold text-[#18392c]">
                  Total Monthly Commitments
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Only active recurring commitments
                  are included.
                </p>

              </div>


              <div className="text-right">

                <p className="text-2xl font-bold text-[#315c46]">

                  ₹{formatMoney(
                    totalMonthlyCommitments
                  )}

                </p>

                <p className="mt-1 text-[10px] text-slate-400">
                  per month
                </p>

              </div>

            </div>

          </div>


          {/* ==================================================
              MONTHLY OVERVIEW
             ================================================== */}

          <div className="mt-7">

            <h2 className="text-base font-semibold text-[#18392c]">
              Monthly Overview
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Active recurring financial commitments.
            </p>


            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">

              <OverviewCard
                icon={
                  <FiTrendingUp />
                }
                title="Investments"
                amount={
                  monthlyInvestmentCommitment
                }
                count={
                  activeInvestments.length
                }
                description="monthly equivalent"
                formatMoney={
                  formatMoney
                }
              />


              <OverviewCard
                icon={
                  <FiShield />
                }
                title="Insurance"
                amount={
                  monthlyInsuranceCommitment
                }
                count={
                  activeInsurance.length
                }
                description="monthly premium equivalent"
                formatMoney={
                  formatMoney
                }
              />


              <OverviewCard
                icon={
                  <FiCreditCard />
                }
                title="Liabilities"
                amount={
                  monthlyLiabilityCommitment
                }
                count={
                  activeLiabilities.length
                }
                description="monthly EMI / payment"
                formatMoney={
                  formatMoney
                }
              />

            </div>

          </div>


          {/* ==================================================
              RECORDS
             ================================================== */}

          <div className="mt-7 rounded-2xl border border-[#e2e8dc] bg-white p-6">

            <h2 className="text-base font-semibold text-[#18392c]">
              Your Plans & Commitments
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Manage the financial plans you have added.
            </p>


            {hasNoPlans ? (

              <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#dce5d7] bg-[#fafcf8] px-6 text-center">

                <FiTrendingUp className="text-2xl text-[#315c46]" />

                <h3 className="mt-4 text-sm font-semibold text-[#18392c]">
                  No plans or commitments yet
                </h3>

                <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                  Add an investment, insurance policy
                  or liability when you have one.
                </p>

                <button
                  type="button"
                  onClick={
                    openPlanSelector
                  }
                  className="mt-5 flex items-center gap-2 rounded-xl border border-[#dce5d7] bg-white px-4 py-2.5 text-xs font-semibold text-[#315c46]"
                >

                  <FiPlus />

                  Add First Plan

                </button>

              </div>

            ) : (

              <div className="mt-7 space-y-9">


                {/* =============================================
                    INVESTMENTS
                   ============================================= */}

                {investmentList.length > 0 && (

                  <section>

                    <SectionTitle
                      icon={
                        <FiTrendingUp />
                      }
                      title="Investments"
                      count={
                        investmentList.length
                      }
                    />


                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">

                      {investmentList.map(
                        (investment) => (

                          <InvestmentCard
                            key={
                              investment.id
                            }
                            investment={
                              investment
                            }
                            formatMoney={
                              formatMoney
                            }
                            updateStatus={
                              updateInvestmentStatus
                            }
                            onPause={(item) =>
                              handlePausePlan(item, "investment")
                            }
                            onResume={(item) =>
                              handleResumePlan(item, "investment")
                            }
                            onMarkMatured={(item) =>
                              handleMarkMatured(item)
                            }
                            deleteItem={
                              handleDeleteInvestment
                            }
                            recordFDInterest={
                              openFDInterestModal
                            }
                            openMaturityActionModal={
                              openMaturityActionModal
                            }
                            openRecordMaturityModal={
                              openRecordMaturityModal
                            }
                            recordSIPContribution={
                              openSIPContributionModal
                            }
                            onManageReminder={(item) =>
                              setReminderTarget({ item, type: "Investment" })
                            }
                            onEdit={(item) => setEditingInvestment(item)}
                          />

                        )
                      )}

                    </div>

                  </section>

                )}


                {/* =============================================
                    INSURANCE
                   ============================================= */}

                {insuranceList.length > 0 && (

                  <section>

                    <SectionTitle
                      icon={
                        <FiShield />
                      }
                      title="Insurance"
                      count={
                        insuranceList.length
                      }
                    />


                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">

                      {insuranceList.map(
                        (policy) => (

                          <InsuranceCard
                            key={
                              policy.id
                            }
                            policy={
                              policy
                            }
                            formatMoney={
                              formatMoney
                            }
                            updateStatus={
                              updateInsuranceStatus
                            }
                            onPause={(item) =>
                              handlePausePlan(item, "insurance")
                            }
                            onResume={(item) =>
                              handleResumePlan(item, "insurance")
                            }
                            deleteItem={
                              handleDeleteInsurance
                            }
                            onViewDetails={() => setSelectedInsurance(policy)}
                            onManageReminder={(item) =>
                              setReminderTarget({ item, type: "Insurance" })
                            }
                          />

                        )
                      )}

                    </div>

                  </section>

                )}


                {/* =============================================
                    LIABILITIES
                   ============================================= */}

                {liabilityList.length > 0 && (

                  <section>

                    <SectionTitle
                      icon={
                        <FiCreditCard />
                      }
                      title="Liabilities"
                      count={
                        liabilityList.length
                      }
                    />


                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">

                      {liabilityList.map(
                        (liability) => (

                          <LiabilityCard
                            key={
                              liability.id ||
                              liability._id
                            }
                            liability={
                              liability
                            }
                            formatMoney={
                              formatMoney
                            }
                            updateStatus={
                              updateLiabilityStatus
                            }
                            onPause={(item) =>
                              handlePausePlan(item, "liability")
                            }
                            onResume={(item) =>
                              handleResumePlan(item, "liability")
                            }
                            onCloseLiability={(item) =>
                              handleCloseLiability(item)
                            }
                            deleteItem={
                              handleDeleteLiability
                            }
                            recordPayment={
                              openPaymentModal
                            }
                            onViewDetails={() => setSelectedLiability(liability)}
                            onManageReminder={(item) =>
                              setReminderTarget({ item, type: "Liability" })
                            }
                          />

                        )
                      )}

                    </div>

                  </section>

                )}

              </div>

            )}

          </div>

        </div>

      </main>


      {/* ======================================================
          PLAN SELECTOR
         ====================================================== */}

      {showTypeSelector && (

        <PlanTypeSelector
          onClose={() =>
            setShowTypeSelector(false)
          }
          onSelect={
            selectPlanType
          }
        />

      )}


      {/* ======================================================
          INVESTMENT FORM
         ====================================================== */}

      {(selectedPlanType === "investment" || editingInvestment) && (
        <InvestmentForm
          editingInvestment={editingInvestment}
          onClose={() => {
            closeForm();
            setEditingInvestment(null);
          }}
          onSuccess={(opts) => {
            handleFormSuccess(opts);
          }}
        />
      )}


      {/* ======================================================
          INSURANCE FORM (ADD & EDIT)
         ====================================================== */}

      {(selectedPlanType === "insurance" || editingInsurance) && (

        <InsuranceForm
          editingPolicy={editingInsurance}
          onClose={() => {
            closeForm();
            setEditingInsurance(null);
          }}
          onSuccess={(opts) => {
            handleFormSuccess(opts);
          }}
        />

      )}

      {/* ======================================================
          INSURANCE DETAILS VIEW
         ====================================================== */}

      {selectedInsuranceData && (

        <InsuranceDetailsModal
          policy={selectedInsuranceData}
          onClose={() => setSelectedInsurance(null)}
          onEdit={() => {
            setEditingInsurance(selectedInsuranceData);
            setSelectedInsurance(null);
          }}
        />

      )}

      {selectedLiabilityData && (
        <LiabilityDetailsModal
          liability={selectedLiabilityData}
          onClose={() => setSelectedLiability(null)}
          onEdit={() => {
            setEditingLiability(selectedLiabilityData);
            setSelectedLiability(null);
          }}
        />
      )}

      {/* ======================================================
          PLAN REMINDER CONFIGURATION MODAL
         ====================================================== */}

      {reminderTarget && (
        <ReminderConfigModal
          isOpen={Boolean(reminderTarget)}
          onClose={() => setReminderTarget(null)}
          sourceType={reminderTarget.type}
          sourceId={reminderTarget.item?._id || reminderTarget.item?.id}
          itemName={reminderTarget.item?.name || reminderTarget.item?.policyName || reminderTarget.item?.title || "Plan Item"}
          amount={Number(reminderTarget.item?.monthlyContribution || reminderTarget.item?.monthlyPremium || reminderTarget.item?.premiumAmount || reminderTarget.item?.monthlyEMI || 0)}
          dueDate={reminderTarget.item?.nextPaymentDate || reminderTarget.item?.startDate || reminderTarget.item?.maturityDate || ""}
          initialData={reminderTarget.item}
        />
      )}


      {/* ======================================================
          LIABILITY FORM
         ====================================================== */}

      {(selectedPlanType === "liability" || editingLiability) && (

        <LiabilityForm
          editingLiability={editingLiability}
          onClose={() => {
            closeForm();
            setEditingLiability(null);
          }}
          onSuccess={(opts) => {
            handleFormSuccess(opts);
          }}
        />

      )}


      {/* ======================================================
          LIABILITY PAYMENT MODAL
         ====================================================== */}

      {paymentLiability && (

        <PaymentModal
          liability={
            paymentLiability
          }
          paymentAmount={
            paymentAmount
          }
          setPaymentAmount={
            setPaymentAmount
          }
          error={
            paymentError
          }
          formatMoney={
            formatMoney
          }
          onSubmit={
            handleRecordPayment
          }
          onClose={
            closePaymentModal
          }
          selectedMonth={
            selectedMonth
          }
        />

      )}


      {/* ======================================================
          FD INTEREST MODAL
         ====================================================== */}

      {interestInvestment && (

        <FDInterestModal
          investment={
            interestInvestment
          }
          onClose={
            closeFDInterestModal
          }
        />

      )}


      {/* ==========================================================
          SIP CONTRIBUTION MODAL
         ========================================================== */}

      {sipContributionInvestment && (

        <SIPContributionModal
          investment={
            sipContributionInvestment
          }
          onClose={
            closeSIPContributionModal
          }
        />

      )}


      {/* ==========================================================
          INVESTMENT MATURITY ACTION MODAL
      ========================================================== */}

      {maturityInvestment && (

        <div
          className="
            fixed inset-0 z-[9999]
            flex items-center justify-center
            bg-[#10251d]/60
            p-4 sm:p-6
          "
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              closeMaturityActionModal();
            }

          }}
        >

          {/* ======================================================
              MODAL CONTAINER
          ====================================================== */}

          <div
            className="
              flex
              max-h-[90vh]
              w-full
              max-w-4xl
              flex-col
              overflow-hidden
              rounded-3xl
              border
              border-[#dfe8dc]
              bg-[#f8faf7]
              shadow-[0_25px_70px_rgba(24,57,44,0.25)]
            "
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            {/* ====================================================
                HEADER
            ==================================================== */}

            <div
              className="
                shrink-0
                border-b
                border-[#dfe8dc]
                bg-gradient-to-r
                from-[#18392c]
                via-[#315c46]
                to-[#426d55]
                px-5
                py-5
                sm:px-7
              "
            >

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >

                {/* TITLE */}

                <div
                  className="
                    flex
                    min-w-0
                    items-center
                    gap-4
                  "
                >

                  <div
                    className="
                      flex
                      h-12
                      w-12
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      bg-white/15
                      text-white
                      ring-1
                      ring-white/20
                    "
                  >
                    <FiRefreshCw
                      size={21}
                    />
                  </div>


                  <div
                    className="
                      min-w-0
                    "
                  >

                    <p
                      className="
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.18em]
                        text-[#dceadd]
                      "
                    >
                      FinanceOS
                    </p>

                    <h2
                      className="
                        mt-1
                        truncate
                        text-lg
                        font-bold
                        text-white
                        sm:text-xl
                      "
                    >
                      Investment Maturity
                    </h2>

                    <p
                      className="
                        mt-1
                        text-xs
                        text-[#dceadd]
                      "
                    >
                      Decide what to do with your
                      maturity amount.
                    </p>

                  </div>

                </div>


                {/* CLOSE */}

                <button
                  type="button"
                  onClick={
                    closeMaturityActionModal
                  }
                  aria-label="Close maturity options"
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    text-white/80
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  <FiX
                    size={19}
                  />
                </button>

              </div>

            </div>


            {/* ====================================================
                CONTENT
            ==================================================== */}

            <div
              className="
                flex-1
                overflow-y-auto
                px-5
                py-5
                sm:px-7
                sm:py-6
              "
            >

              {/* ==================================================
                  INVESTMENT SUMMARY & ALLOCATION STATUS
              ================================================== */}

              {maturitySuccessMessage && (
                <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#b8deb4] bg-[#edf8ea] p-4 text-xs font-semibold text-[#18392c] animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <FiCheck className="text-[#315c46]" size={16} />
                    <span>{maturitySuccessMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaturitySuccessMessage("")}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {/* INVESTMENT */}
                      <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7a8d82]">
                          Investment Plan
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-[#18392c]">
                          {maturityInvestment.name}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {maturityInvestment.type}
                        </p>
                      </div>

                      {/* MATURITY AMOUNT */}
                      <div className="rounded-2xl border border-[#cfe0d0] bg-[#edf6e8] p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#52705d]">
                          Actual Maturity Amount
                        </p>
                        <p className="mt-1 text-lg font-bold text-[#18392c]">
                          ₹{formatMoney(currentActualMaturity)}
                        </p>
                        <p className="mt-1 text-[10px] text-[#557b64]">
                          Recorded from {maturityInvestment.type}
                        </p>
                      </div>

                      {/* ALLOCATED */}
                      <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7a8d82]">
                          Already Allocated
                        </p>
                        <p className="mt-1 text-lg font-bold text-[#2d523e]">
                          ₹{formatMoney(currentAllocated)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Distributed to destinations
                        </p>
                      </div>

                      {/* REMAINING */}
                      <div className={`rounded-2xl border p-4 ${isMaturityFullyAllocated ? "border-[#c4e2c0] bg-[#f0f9ee]" : "border-[#e0ded0] bg-[#faf8ee]"}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7a8d82]">
                            Remaining
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              isMaturityFullyAllocated
                                ? "bg-[#dcf3db] text-[#1b5e20]"
                                : currentAllocated > 0
                                ? "bg-[#fff3cd] text-[#856404]"
                                : "bg-[#e8ece6] text-[#495b50]"
                            }`}
                          >
                            {isMaturityFullyAllocated
                              ? "Fully Allocated"
                              : currentAllocated > 0
                              ? "Partially Allocated"
                              : "Pending Allocation"}
                          </span>
                        </div>
                        <p className={`mt-1 text-lg font-bold ${isMaturityFullyAllocated ? "text-[#1b5e20]" : "text-[#976a06]"}`}>
                          ₹{formatMoney(currentRemaining)}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {isMaturityFullyAllocated ? "All funds allocated" : "Awaiting allocation"}
                        </p>
                      </div>
                    </div>

                    {/* STATUS BANNER */}
                    {isMaturityFullyAllocated ? (
                      <div className="mb-6 rounded-2xl border border-[#b8deb4] bg-[#edf8ea] p-4 text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#315c46] text-white">
                          <FiCheck size={20} />
                        </div>
                        <h4 className="text-sm font-bold text-[#18392c]">Maturity Proceeds Fully Allocated</h4>
                        <p className="mt-1 text-xs text-[#41624f]">
                          All ₹{formatMoney(currentActualMaturity)} has been successfully distributed across your chosen destinations.
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <h3 className="text-base font-bold text-[#18392c] sm:text-lg">
                          How would you like to use this maturity amount?
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          Select a destination to allocate all or part of the remaining ₹{formatMoney(currentRemaining)}.
                        </p>
                      </div>
                    )}

              {/* ==================================================
                  OPTIONS
              ================================================== */}

              {!renewalMode && !maturityActionType && currentRemaining > 0 && (
                <>
                  {maturityInvestment.afterMaturityAction &&
                    maturityInvestment.afterMaturityAction !== "MANUAL_DECIDE" && (
                      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#9fc4a3] bg-[#ecf7ea] p-4 shadow-xs">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#315c46] text-white">
                            <FiCheck size={18} />
                          </span>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2e5d42]">
                              Configured Post-Maturity Preference
                            </p>
                            <p className="text-sm font-bold text-[#18392c]">
                              {maturityInvestment.afterMaturityAction === "BANK_SAVINGS"
                                ? "Transfer to Bank / Savings"
                                : maturityInvestment.afterMaturityAction === "RENEW_FULL"
                                ? "Renew Investment in Full"
                                : maturityInvestment.afterMaturityAction === "KEEP_CASH"
                                ? "Keep as Cash (Allocate Pool)"
                                : maturityInvestment.afterMaturityAction === "NEW_INVESTMENT"
                                ? "Reinvest in New Scheme"
                                : maturityInvestment.afterMaturityAction === "PAY_LIABILITY"
                                ? "Pay Down Liability"
                                : maturityInvestment.afterMaturityAction}
                            </p>
                            <p className="text-[11px] text-[#486f56]">
                              Pre-selected during investment setup. Click to execute with pre-filled details.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (maturityInvestment.afterMaturityAction === "RENEW_FULL") {
                              openRenewalForm("full");
                            } else {
                              openMaturityActionForm(maturityInvestment.afterMaturityAction);
                            }
                          }}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#18392c] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#25503e]"
                        >
                          Apply Configured Option
                          <FiArrowRight size={13} />
                        </button>
                      </div>
                    )}

                <div
                  className="
                    grid
                    grid-cols-1
                    gap-3
                    md:grid-cols-2
                  "
                >

                  {/* RENEW FULL */}

                  <button
                    type="button"
                    onClick={() => {
                      openRenewalForm("full");
                    }}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#edf6e8]
                          text-[#315c46]
                        "
                      >
                        <FiRefreshCw
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Renew Full Amount
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Continue with the complete
                          maturity amount.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* RENEW PARTIAL */}

                  <button
                    type="button"
                    onClick={() => {
                      openRenewalForm("partial");
                    }}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#f2f6ee]
                          text-[#315c46]
                        "
                      >
                        <FiTrendingUp
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Renew Partial Amount
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Renew part of the money and
                          decide what to do with the rest.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* SAVE IN BANK */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("BANK_SAVINGS")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#edf6e8]
                          text-[#315c46]
                        "
                      >
                        <FiCreditCard
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Save in Bank
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Record the money moved to a
                          savings or bank account.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* PURCHASE */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("PURCHASE")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#f2f6ee]
                          text-[#315c46]
                        "
                      >
                        <FiShoppingBag
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Buy Something
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Record a purchase made using
                          the maturity money.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* NEW INVESTMENT */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("NEW_INVESTMENT")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#edf6e8]
                          text-[#315c46]
                        "
                      >
                        <FiBarChart2
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Invest Elsewhere
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Record money moved into another
                          investment.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* LIABILITY */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("PAY_LIABILITY")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#f2f6ee]
                          text-[#315c46]
                        "
                      >
                        <FiCreditCard
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Pay Liability
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Use the maturity money toward
                          a loan or other liability.
                        </p>

                      </div>

                    </div>

                  </button>


                  {/* CASH */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("KEEP_CASH")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#edf6e8]
                          text-[#315c46]
                        "
                      >
                        <span className="font-bold text-base">₹</span>
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Keep as Cash
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Keep some or all of the amount
                          available as cash.
                        </p>

                      </div>

                    </div>

                  </button>

                  {/* OTHER */}

                  <button
                    type="button"
                    onClick={() => openMaturityActionForm("OTHER")}
                    className="
                      group
                      rounded-2xl
                      border
                      border-[#dfe8dc]
                      bg-white
                      p-4
                      text-left
                      transition
                      hover:-translate-y-0.5
                      hover:border-[#9fbea6]
                      hover:bg-[#f7faf5]
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >

                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#f2f6ee]
                          text-[#315c46]
                        "
                      >
                        <FiLayers
                          size={18}
                        />
                      </div>

                      <div>

                        <p
                          className="
                            text-sm
                            font-semibold
                            text-[#18392c]
                          "
                        >
                          Other Purpose
                        </p>

                        <p
                          className="
                            mt-1
                            text-[11px]
                            leading-5
                            text-slate-400
                          "
                        >
                          Medical, education, family, or other specific use of maturity funds.
                        </p>

                      </div>

                    </div>

                  </button>

                </div>
                </>
              )}


              {/* ==================================================
                  RENEWAL FORM
              ================================================== */}

              {renewalMode && (

                <div
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-[#c9dcca]
                    bg-white
                    p-5
                    shadow-sm
                  "
                >

                  {/* ==================================================
                      HEADER
                  ================================================== */}

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-4
                    "
                  >

                    <div>

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-[0.15em]
                          text-[#6c8b72]
                        "
                      >
                        Investment Renewal
                      </p>

                      <h3
                        className="
                          mt-1
                          text-lg
                          font-bold
                          text-[#18392c]
                        "
                      >
                        {renewalMode === "full"
                          ? "Renew Full Amount"
                          : "Renew Partial Amount"}
                      </h3>

                      <p
                        className="
                          mt-1
                          text-xs
                          leading-5
                          text-slate-400
                        "
                      >
                        Continue this investment using the
                        existing investment terms.
                      </p>

                    </div>


                    <button
                      type="button"
                      onClick={() => {

                        setRenewalMode(null);

                        setRenewalChangeMode(false);

                        setRenewalError("");

                      }}
                      className="
                        rounded-xl
                        px-3
                        py-2
                        text-xs
                        font-semibold
                        text-[#52665b]
                        hover:bg-[#f2f6ee]
                      "
                    >
                      Back
                    </button>

                  </div>


                  {/* ==================================================
                      MATURITY SUMMARY
                  ================================================== */}

                  <div
                    className="
                      mt-5
                      grid
                      grid-cols-1
                      gap-3
                      sm:grid-cols-2
                    "
                  >

                    <div
                      className="
                        rounded-xl
                        border
                        border-[#dfe8dc]
                        bg-[#f8faf7]
                        p-4
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wide
                          text-[#6c8b72]
                        "
                      >
                        Maturity Amount
                      </p>

                      <p
                        className="
                          mt-1
                          text-xl
                          font-bold
                          text-[#18392c]
                        "
                      >
                        ₹
                        {formatMoney(
                          maturityAmountForDisplay
                        )}
                      </p>

                    </div>


                    <div
                      className="
                        rounded-xl
                        border
                        border-[#dfe8dc]
                        bg-[#f8faf7]
                        p-4
                      "
                    >

                      <p
                        className="
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wide
                          text-[#6c8b72]
                        "
                      >
                        Current Investment
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          font-bold
                          text-[#18392c]
                        "
                      >
                        {maturityInvestment.name}
                      </p>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          text-slate-400
                        "
                      >
                        {maturityInvestment.type}
                      </p>

                    </div>

                  </div>


                  {/* ==================================================
                      SAME TERMS CONFIRMATION
                  ================================================== */}

                  {!renewalChangeMode && (

                    <div
                      className="
                        mt-5
                        rounded-2xl
                        border
                        border-[#dcebd4]
                        bg-[#f4faef]
                        p-5
                      "
                    >

                      <div
                        className="
                          text-center
                        "
                      >

                        <p
                          className="
                            text-base
                            font-bold
                            text-[#18392c]
                          "
                        >
                          Renew with the existing terms?
                        </p>

                        <p
                          className="
                            mx-auto
                            mt-2
                            max-w-xl
                            text-xs
                            leading-5
                            text-[#61766a]
                          "
                        >
                          Your existing investment details will
                          be carried forward automatically.
                          You do not need to enter the bank,
                          interest rate, or interest method again.
                        </p>

                      </div>


                      {/* FULL RENEWAL AMOUNT */}

                      <div
                        className="
                          mx-auto
                          mt-4
                          max-w-md
                          rounded-xl
                          border
                          border-[#dfe8dc]
                          bg-white
                          p-4
                          text-center
                        "
                      >

                        <p
                          className="
                            text-[10px]
                            font-semibold
                            uppercase
                            tracking-wide
                            text-[#6c8b72]
                          "
                        >
                          Amount to Renew
                        </p>

                        <p
                          className="
                            mt-1
                            text-2xl
                            font-bold
                            text-[#18392c]
                          "
                        >
                          ₹
                          {formatMoney(
                            renewalMode === "full"
                              ? maturityAmountForDisplay
                              : Number(
                                  renewalAmount || 0
                                )
                          )}
                        </p>

                      </div>


                      {/* ACTION BUTTONS */}

                      <div
                        className="
                          mt-5
                          flex
                          flex-col
                          gap-2
                          sm:flex-row
                          sm:justify-center
                        "
                      >

                        <button
                          type="button"
                          onClick={
                            handleConfirmRenewal
                          }
                          className="
                            rounded-xl
                            bg-[#18392c]
                            px-6
                            py-3
                            text-xs
                            font-semibold
                            text-white
                            shadow-sm
                            transition
                            hover:bg-[#244c3b]
                          "
                        >
                          Yes, Renew as It Is
                        </button>


                        <button
                          type="button"
                          onClick={() => {

                            setRenewalChangeMode(
                              true
                            );

                            if (
                              renewalMode ===
                              "full"
                            ) {

                              setRenewalAmount(
                                String(
                                  maturityAmountForDisplay
                                )
                              );

                            }

                          }}
                          className="
                            rounded-xl
                            border
                            border-[#cbdac8]
                            bg-white
                            px-6
                            py-3
                            text-xs
                            font-semibold
                            text-[#315c46]
                            transition
                            hover:bg-[#f2f6ee]
                          "
                        >
                          No, Change Renewal Details
                        </button>

                      </div>

                    </div>

                  )}


                  {/* ==================================================
                      CHANGE RENEWAL DETAILS
                  ================================================== */}

                  {renewalChangeMode && (

                    <div
                      className="
                        mt-5
                        rounded-2xl
                        border
                        border-[#dfe8dc]
                        bg-[#fafcf8]
                        p-5
                      "
                    >

                      <p
                        className="
                          text-sm
                          font-bold
                          text-[#18392c]
                        "
                      >
                        Change Renewal Details
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          text-slate-400
                        "
                      >
                        Change only the details you want to
                        modify. Existing investment terms will
                        remain unchanged.
                      </p>


                      {/* =================================================
                          PARTIAL AMOUNT
                      ================================================= */}

                      {renewalMode === "partial" && (

                        <div className="mt-5">

                          <label
                            className="
                              text-xs
                              font-semibold
                              text-[#52665b]
                            "
                          >
                            Amount to Renew
                          </label>

                          <div className="relative mt-1">

                            <span
                              className="
                                absolute
                                left-3
                                top-1/2
                                -translate-y-1/2
                                font-semibold
                                text-[#6c8b72]
                              "
                            >
                              ₹
                            </span>

                            <input
                              type="number"
                              min="1"
                              max={
                                maturityAmountForDisplay
                              }
                              value={renewalAmount}
                              onChange={(event) =>
                                setRenewalAmount(
                                  event.target.value
                                )
                              }
                              className="
                                w-full
                                rounded-xl
                                border
                                border-[#dfe8dc]
                                bg-white
                                py-3
                                pl-8
                                pr-3
                                text-sm
                                font-semibold
                                text-[#18392c]
                                outline-none
                                focus:border-[#7da889]
                                focus:ring-2
                                focus:ring-[#dcebd4]
                              "
                            />

                          </div>


                          <div
                            className="
                              mt-2
                              flex
                              items-center
                              justify-between
                            "
                          >

                            <span
                              className="
                                text-[11px]
                                text-slate-400
                              "
                            >
                              Maturity Amount
                            </span>

                            <span
                              className="
                                text-xs
                                font-semibold
                                text-[#315c46]
                              "
                            >
                              ₹
                              {formatMoney(
                                maturityAmountForDisplay
                              )}
                            </span>

                          </div>


                          <div
                            className="
                              mt-3
                              rounded-xl
                              bg-[#edf6e8]
                              px-4
                              py-3
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                justify-between
                              "
                            >

                              <span
                                className="
                                  text-xs
                                  text-[#6c8b72]
                                "
                              >
                                Remaining Amount
                              </span>

                              <span
                                className="
                                  text-sm
                                  font-bold
                                  text-[#315c46]
                                "
                              >
                                ₹
                                {formatMoney(
                                  Math.max(
                                    0,
                                    maturityAmountForDisplay -
                                    Number(
                                      renewalAmount || 0
                                    )
                                  )
                                )}
                              </span>

                            </div>

                          </div>

                        </div>

                      )}


                      {/* =================================================
                          PAYMENT OPTION
                      ================================================= */}

                      <div className="mt-5">

                        <label
                          className="
                            text-xs
                            font-semibold
                            text-[#52665b]
                          "
                        >
                          Payment / Contribution Option
                        </label>

                        <select
                          value={
                            renewalPaymentOption
                          }
                          onChange={(event) =>
                            setRenewalPaymentOption(
                              event.target.value
                            )
                          }
                          className="
                            mt-1
                            w-full
                            rounded-xl
                            border
                            border-[#dfe8dc]
                            bg-white
                            px-3
                            py-3
                            text-sm
                            text-[#18392c]
                            outline-none
                            focus:border-[#7da889]
                            focus:ring-2
                            focus:ring-[#dcebd4]
                          "
                        >

                          <option value="same">
                            Keep Same as Existing
                          </option>

                          <option value="one-time">
                            One Time
                          </option>

                          <option value="recurring">
                            Recurring
                          </option>

                        </select>

                      </div>


                      {/* =================================================
                          FREQUENCY
                      ================================================= */}

                      {renewalPaymentOption ===
                        "recurring" && (

                        <div className="mt-4">

                          <label
                            className="
                              text-xs
                              font-semibold
                              text-[#52665b]
                            "
                          >
                            Contribution Frequency
                          </label>

                          <select
                            value={
                              renewalFrequency
                            }
                            onChange={(event) =>
                              setRenewalFrequency(
                                event.target.value
                              )
                            }
                            className="
                              mt-1
                              w-full
                              rounded-xl
                              border
                              border-[#dfe8dc]
                              bg-white
                              px-3
                              py-3
                              text-sm
                              text-[#18392c]
                              outline-none
                              focus:border-[#7da889]
                              focus:ring-2
                              focus:ring-[#dcebd4]
                            "
                          >

                            <option value="Monthly">
                              Monthly
                            </option>

                            <option value="Quarterly">
                              Quarterly
                            </option>

                            <option value="Yearly">
                              Yearly
                            </option>

                          </select>

                        </div>

                      )}


                      {/* =================================================
                          NEW MATURITY DATE
                      ================================================= */}

                      <div className="mt-4">

                        <label
                          className="
                            text-xs
                            font-semibold
                            text-[#52665b]
                          "
                        >
                          New Maturity Date
                        </label>

                        <input
                          type="date"
                          value={
                            renewalMaturityDate
                          }
                          onChange={(event) =>
                            setRenewalMaturityDate(
                              event.target.value
                            )
                          }
                          className="
                            mt-1
                            w-full
                            rounded-xl
                            border
                            border-[#dfe8dc]
                            bg-white
                            px-3
                            py-3
                            text-sm
                            text-[#18392c]
                            outline-none
                            focus:border-[#7da889]
                            focus:ring-2
                            focus:ring-[#dcebd4]
                          "
                        />

                      </div>


                      {/* ERROR */}

                      {renewalError && (

                        <div
                          className="
                            mt-4
                            rounded-xl
                            border
                            border-red-200
                            bg-red-50
                            px-4
                            py-3
                          "
                        >

                          <p
                            className="
                              text-xs
                              text-red-600
                            "
                          >
                            {renewalError}
                          </p>

                        </div>

                      )}


                      {/* BUTTONS */}

                      <div
                        className="
                          mt-5
                          flex
                          flex-col-reverse
                          gap-2
                          border-t
                          border-[#edf0e9]
                          pt-5
                          sm:flex-row
                          sm:justify-end
                        "
                      >

                        <button
                          type="button"
                          onClick={() => {

                            setRenewalChangeMode(
                              false
                            );

                            setRenewalError("");

                          }}
                          className="
                            rounded-xl
                            border
                            border-[#d7e1d5]
                            bg-white
                            px-5
                            py-2.5
                            text-xs
                            font-semibold
                            text-[#52665b]
                            hover:bg-[#f4f7f1]
                          "
                        >
                          Back
                        </button>


                        <button
                          type="button"
                          onClick={
                            handleConfirmRenewal
                          }
                          className="
                            rounded-xl
                            bg-[#18392c]
                            px-5
                            py-2.5
                            text-xs
                            font-semibold
                            text-white
                            shadow-sm
                            hover:bg-[#244c3b]
                          "
                        >
                          Confirm Renewal
                        </button>

                      </div>

                    </div>

                  )}

                </div>

              )}

              {/* ==================================================
                  MATURITY ACTION DEDICATED FORMS
              ================================================== */}

              {maturityActionType && (
                <div className="mt-5 rounded-2xl border border-[#c9dcca] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-[#e6ebe6] pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf6e8] text-[#315c46]">
                        {maturityActionType === "BANK_SAVINGS" ? <FiCreditCard size={16} /> :
                         maturityActionType === "KEEP_CASH" ? <FiDollarSign size={16} /> :
                         maturityActionType === "PURCHASE" ? <FiShoppingBag size={16} /> :
                         maturityActionType === "NEW_INVESTMENT" ? <FiBarChart2 size={16} /> :
                         maturityActionType === "PAY_LIABILITY" ? <FiCreditCard size={16} /> :
                         <FiLayers size={16} />}
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6c8b72]">
                          Post-Maturity Allocation
                        </p>
                        <h4 className="text-base font-bold text-[#18392c]">
                          {maturityActionType === "BANK_SAVINGS" ? "Save in Bank" :
                           maturityActionType === "KEEP_CASH" ? "Keep as Cash" :
                           maturityActionType === "PURCHASE" ? "Buy Something" :
                           maturityActionType === "NEW_INVESTMENT" ? "Invest Maturity Proceeds" :
                           maturityActionType === "PAY_LIABILITY" ? "Pay Down Liability" :
                           "Other Purpose"}
                        </h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMaturityActionType(null);
                        setMaturityActionError("");
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <FiX size={16} />
                    </button>
                  </div>

                  {/* Destination Information Banners */}
                  {maturityActionType === "KEEP_CASH" && (
                    <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-800 flex items-start gap-2">
                      <FiInfo className="shrink-0 mt-0.5 text-emerald-600" size={15} />
                      <span>
                        <strong>Cash Allocation:</strong> This will increase your <strong>Available to Allocate</strong> immediately by the allocated amount.
                      </span>
                    </div>
                  )}

                  {maturityActionType === "BANK_SAVINGS" && (
                    <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 flex items-start gap-2">
                      <FiInfo className="shrink-0 mt-0.5 text-blue-600" size={15} />
                      <span>
                        <strong>Bank Destination:</strong> Records funds safely moved into your bank account. Does NOT inflate Available to Allocate, preventing double counting.
                      </span>
                    </div>
                  )}

                  {maturityActionType === "PAY_LIABILITY" && (
                    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 flex items-start gap-2">
                      <FiInfo className="shrink-0 mt-0.5 text-amber-600" size={15} />
                      <span>
                        <strong>Liability Paydown:</strong> Reduces your liability's outstanding balance directly and records a prepayment. Available to Allocate is unaffected.
                      </span>
                    </div>
                  )}

                  {maturityActionType === "NEW_INVESTMENT" && (
                    <div className="mb-4 rounded-xl bg-purple-50 border border-purple-100 p-3 text-xs text-purple-800 flex items-start gap-2">
                      <FiInfo className="shrink-0 mt-0.5 text-purple-600" size={15} />
                      <span>
                        <strong>Reinvestment:</strong> Creates a new active investment linked to this matured plan as the funding source. Does NOT draw from monthly disposable cash.
                      </span>
                    </div>
                  )}

                  {maturityActionType === "PURCHASE" && (
                    <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 flex items-start gap-2">
                      <FiInfo className="shrink-0 mt-0.5 text-slate-500" size={15} />
                      <span>
                        <strong>Purchase Expenditure:</strong> Records an asset or consumer purchase funded directly by maturity proceeds. Does NOT create an investment or inflate cash.
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Destination: BANK_SAVINGS */}
                    {maturityActionType === "BANK_SAVINGS" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Bank Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. HDFC Bank, SBI, ICICI"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Account Last 4 Digits <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            placeholder="4521"
                            value={accountLast4}
                            onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm font-mono text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                          <p className="mt-1 text-[10px] text-slate-400">Do not enter complete account number</p>
                        </div>
                      </div>
                    )}

                    {/* Destination: PURCHASE */}
                    {maturityActionType === "PURCHASE" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            What did you buy? <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Laptop, Car, Furniture, Travel"
                            value={purchaseItemName}
                            onChange={(e) => setPurchaseItemName(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Category
                          </label>
                          <select
                            value={purchaseCategory}
                            onChange={(e) => setPurchaseCategory(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          >
                            <option value="Electronics">Electronics</option>
                            <option value="Automobile">Automobile / Vehicle</option>
                            <option value="Furniture">Furniture</option>
                            <option value="Travel">Travel & Vacation</option>
                            <option value="Property">Property-related purchase</option>
                            <option value="Appliances">Home Appliances</option>
                            <option value="Other">Other Purchase</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Purchase Date
                          </label>
                          <input
                            type="date"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Destination: NEW_INVESTMENT */}
                    {maturityActionType === "NEW_INVESTMENT" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Investment Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={newInvestmentType}
                            onChange={(e) => setNewInvestmentType(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          >
                            <option value="Mutual Fund">Mutual Fund</option>
                            <option value="SIP">SIP</option>
                            <option value="FD">Fixed Deposit (FD)</option>
                            <option value="RD">Recurring Deposit (RD)</option>
                            <option value="Gold">Gold</option>
                            <option value="Stocks">Stocks / Equity</option>
                            <option value="Other">Other Investment</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Scheme / Plan Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. SBI Bluechip Fund, Sovereign Gold"
                            value={newInvestmentName}
                            onChange={(e) => setNewInvestmentName(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Investment Date
                          </label>
                          <input
                            type="date"
                            value={newInvestmentDate}
                            onChange={(e) => setNewInvestmentDate(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Target Maturity Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={newMaturityDate}
                            onChange={(e) => setNewMaturityDate(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Destination: PAY_LIABILITY */}
                    {maturityActionType === "PAY_LIABILITY" && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Select Active Liability to Pay <span className="text-red-500">*</span>
                          </label>
                          {(() => {
                            const activeLiabs = (liabilities || []).filter(
                              (l) => l.status === "Active" || Number(l.remainingAmount || 0) > 0
                            );
                            if (activeLiabs.length === 0) {
                              return (
                                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 border border-amber-200">
                                  No active liabilities with outstanding balance found in your records.
                                </div>
                              );
                            }
                            const selectedLiabObj = activeLiabs.find(
                              (l) => String(l._id || l.id) === String(selectedLiabilityId)
                            );
                            return (
                              <div className="space-y-2">
                                <select
                                  value={selectedLiabilityId}
                                  onChange={(e) => {
                                    setSelectedLiabilityId(e.target.value);
                                    const liab = activeLiabs.find(
                                      (l) => String(l._id || l.id) === String(e.target.value)
                                    );
                                    if (liab) {
                                      const defaultAmt = Math.min(
                                        currentRemaining,
                                        Number(liab.remainingAmount || 0)
                                      );
                                      setMaturityActionAmount(String(defaultAmt));
                                    }
                                  }}
                                  className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                                >
                                  {activeLiabs.map((l) => (
                                    <option key={l._id || l.id} value={String(l._id || l.id)}>
                                      {l.name} — Outstanding: ₹{formatMoney(l.remainingAmount || 0)}
                                    </option>
                                  ))}
                                </select>
                                {selectedLiabObj && (
                                  <div className="rounded-xl bg-[#f5f9f3] p-3 text-xs border border-[#dce8d7] flex items-center justify-between">
                                    <span className="text-slate-500">Current Outstanding:</span>
                                    <span className="font-bold text-[#18392c]">
                                      ₹{formatMoney(selectedLiabObj.remainingAmount || 0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Payment Date
                          </label>
                          <input
                            type="date"
                            value={liabilityPaymentDate}
                            onChange={(e) => setLiabilityPaymentDate(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Destination: OTHER */}
                    {maturityActionType === "OTHER" && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            What did you use the maturity money for? <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Medical emergency fund, children tuition fee, gift"
                            value={otherDescription}
                            onChange={(e) => setOtherDescription(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Category
                          </label>
                          <select
                            value={otherCategory}
                            onChange={(e) => setOtherCategory(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          >
                            <option value="Medical">Medical / Healthcare</option>
                            <option value="Education">Education / Tuition</option>
                            <option value="Gifting">Gifting / Donation</option>
                            <option value="Family Support">Family Support</option>
                            <option value="Emergency">Emergency Expense</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                            Date
                          </label>
                          <input
                            type="date"
                            value={otherDate}
                            onChange={(e) => setOtherDate(e.target.value)}
                            className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Destination: KEEP_CASH */}
                    {maturityActionType === "KEEP_CASH" && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                          Cash Date
                        </label>
                        <input
                          type="date"
                          value={cashDate}
                          onChange={(e) => setCashDate(e.target.value)}
                          className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                        />
                      </div>
                    )}

                    {/* Common Amount Field */}
                    <div className="border-t border-[#edf2ea] pt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#18392c]">
                          Allocation Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-[#557b64]">
                          Available Remaining: <strong>₹{formatMoney(currentRemaining)}</strong>
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6c8b72]">₹</span>
                        <input
                          type="number"
                          min="1"
                          max={currentRemaining}
                          value={maturityActionAmount}
                          onChange={(e) => setMaturityActionAmount(e.target.value)}
                          className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] py-2.5 pl-8 pr-3 text-sm font-bold text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                        />
                      </div>
                    </div>

                    {/* Common Note Field */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#52665b]">
                        Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={maturityActionNote}
                        onChange={(e) => setMaturityActionNote(e.target.value)}
                        placeholder="Add any additional context or reference..."
                        className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-4 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d] focus:bg-white focus:ring-2 focus:ring-[#dcebd4]"
                      />
                    </div>

                    {maturityActionError && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
                        {maturityActionError}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#edf2ea]">
                      <button
                        type="button"
                        onClick={() => {
                          setMaturityActionType(null);
                          setMaturityActionError("");
                        }}
                        disabled={isSubmittingMaturityAction}
                        className="rounded-xl border border-[#d7e1d5] bg-white px-4 py-2.5 text-xs font-semibold text-[#52665b] hover:bg-[#f4f7f1]"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmMaturityAction}
                        disabled={isSubmittingMaturityAction}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#18392c] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#244c3b] disabled:opacity-50"
                      >
                        {isSubmittingMaturityAction ? (
                          <>
                            <FiRefreshCw className="animate-spin" size={13} />
                            Allocating...
                          </>
                        ) : (
                          <>
                            Confirm Allocation
                            <FiArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================================================
                  MATURITY ALLOCATION LEDGER
              ================================================== */}
              <div className="mt-6 rounded-2xl border border-[#dfe8dc] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#edf2ea] pb-3">
                  <div className="flex items-center gap-2">
                    <FiLayers className="text-[#315c46]" size={16} />
                    <h4 className="text-sm font-bold text-[#18392c]">Maturity Allocation History</h4>
                  </div>
                  <span className="rounded-full bg-[#edf6e8] px-2.5 py-0.5 text-[10px] font-bold text-[#315c46]">
                    {maturityAllocationsList.length} {maturityAllocationsList.length === 1 ? "Record" : "Records"}
                  </span>
                </div>

                {isLoadingAllocations ? (
                  <div className="flex items-center justify-center py-8">
                    <FiRefreshCw className="h-6 w-6 animate-spin text-[#315c46]" />
                    <span className="ml-2 text-xs font-semibold text-[#52665b]">Loading allocations...</span>
                  </div>
                ) : maturityAllocationsList.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-slate-400">No allocations have been made yet from this maturity amount.</p>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-[#edf2ea] overflow-x-auto">
                    {maturityAllocationsList.map((alloc, idx) => (
                      <div key={alloc._id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            alloc.actionType === "KEEP_CASH"
                              ? "bg-emerald-100 text-emerald-800"
                              : alloc.actionType === "PAY_LIABILITY"
                              ? "bg-amber-100 text-amber-800"
                              : alloc.actionType === "BANK_SAVINGS"
                              ? "bg-blue-100 text-blue-800"
                              : alloc.actionType === "NEW_INVESTMENT" || alloc.actionType === "RENEW_FULL" || alloc.actionType === "RENEW_PARTIAL"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-stone-100 text-stone-800"
                          }`}>
                            {alloc.actionType.replace(/_/g, " ")}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-[#18392c]">
                              {alloc.actionType === "BANK_SAVINGS" && alloc.bankDetails
                                ? `${alloc.bankDetails.bankName || "Bank"} (••••${alloc.bankDetails.accountLast4 || "----"})`
                                : alloc.actionType === "PAY_LIABILITY" && alloc.liabilityDetails
                                ? `Paid toward: ${alloc.liabilityDetails.liabilityName || "Liability"}`
                                : alloc.actionType === "PURCHASE" && alloc.purchaseDetails
                                ? `Purchased: ${alloc.purchaseDetails.itemName || "Item"} (${alloc.purchaseDetails.category || "General"})`
                                : alloc.actionType === "NEW_INVESTMENT" && alloc.investmentDetails
                                ? `Reinvested: ${alloc.investmentDetails.investmentName || "New Plan"} (${alloc.investmentDetails.investmentType || "Investment"})`
                                : alloc.actionType === "KEEP_CASH"
                                ? "Transferred to Available Cash"
                                : alloc.actionType === "OTHER" && alloc.otherDetails
                                ? `${alloc.otherDetails.description || "Other"} (${alloc.otherDetails.category || "General"})`
                                : alloc.actionType.replace(/_/g, " ")}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {alloc.actionDate ? new Date(alloc.actionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              {alloc.note ? ` • Note: ${alloc.note}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#18392c]">₹{formatMoney(alloc.actionAmount)}</p>
                          <span className="text-[10px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                            <FiCheck size={10} /> Completed
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ==================================================
                  AI SUGGESTION
              ================================================== */}

              <div
                className="
                  mt-5
                  rounded-2xl
                  border
                  border-[#c9dcca]
                  bg-gradient-to-r
                  from-[#edf6e8]
                  to-[#f4f8f1]
                  p-5
                  transition-all
                "
              >
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <FiRefreshCw className="h-8 w-8 animate-spin text-[#315c46]" />
                    <p className="mt-3 text-sm font-bold text-[#18392c]">
                      {aiLoadingMessage || "Analyzing your finances..."}
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-[#61766a]">
                      Refreshing your latest financial records from MongoDB and fetching live market rates to build a fresh recommendation.
                    </p>
                  </div>
                ) : latestAISuggestion ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#d7e5d5] pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#315c46] text-white">
                          <FiZap size={17} />
                        </div>
                        <div>
                          <span className="inline-block rounded-full bg-[#315c46]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
                            {latestAISuggestion.category || "AI Recommendation"}
                          </span>
                          <h4 className="text-sm font-bold text-[#18392c]">
                            {latestAISuggestion.title}
                          </h4>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleGetAISuggestion}
                        disabled={aiLoading}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#cbdac8] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#315c46] shadow-sm transition hover:bg-[#edf4ea] disabled:opacity-50 cursor-pointer"
                      >
                        <FiRefreshCw size={12} className={aiLoading ? "animate-spin" : ""} />
                        <span>{aiLoading ? "Analyzing..." : "Re-analyze"}</span>
                      </button>
                    </div>

                    {/* Summary */}
                    <p className="text-xs font-medium leading-5 text-[#2d493a]">
                      {latestAISuggestion.summary}
                    </p>

                    {/* Key Observations */}
                    {Array.isArray(latestAISuggestion.keyObservations) && latestAISuggestion.keyObservations.length > 0 && (
                      <div className="rounded-xl bg-white/80 p-3.5 border border-[#dce7d9]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#61766a] mb-2">
                          Key Observations
                        </p>
                        <ul className="space-y-1.5 text-xs text-[#2e473a]">
                          {latestAISuggestion.keyObservations.map((obs, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <FiCheckCircle size={14} className="shrink-0 text-[#315c46] mt-0.5" />
                              <span>{obs}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Steps */}
                    {Array.isArray(latestAISuggestion.actionSteps) && latestAISuggestion.actionSteps.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#61766a] mb-2">
                          Recommended Action Steps
                        </p>
                        <div className="space-y-2">
                          {latestAISuggestion.actionSteps.map((action, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 rounded-xl border border-[#dce7d9] bg-white p-3 shadow-xs"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#edf6e8] text-[11px] font-bold text-[#315c46]">
                                {action.step || idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-[#18392c]">
                                    {action.title}
                                  </p>
                                  {action.priority && (
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        action.priority === "high"
                                          ? "bg-red-50 text-red-600 border border-red-100"
                                          : action.priority === "medium"
                                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                                          : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      }`}
                                    >
                                      {action.priority} priority
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                  {action.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Advice snippet */}
                    {latestAISuggestion.detailedAdvice && (
                      <div className="text-xs leading-5 text-slate-600 bg-white/60 p-3 rounded-xl border border-[#e2ece0]">
                        <p className="line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                          {latestAISuggestion.detailedAdvice}
                        </p>
                      </div>
                    )}

                    {/* Future Outlook (Scenario-based) */}
                    {latestAISuggestion.futureOutlook && (
                      <div className="rounded-xl border border-[#dce7d9] bg-white/80 p-3 space-y-1.5 text-xs text-[#2c4739]">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
                            Future Outlook (Scenarios & Risks)
                          </p>
                          <span className="text-[9px] text-slate-400 font-semibold">Non-Guaranteed</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Base Case:</strong> {latestAISuggestion.futureOutlook.baseCase || "Moderate growth with range-bound asset valuations in the short term."}
                        </p>
                        {Array.isArray(latestAISuggestion.futureOutlook.keyRisks) && latestAISuggestion.futureOutlook.keyRisks.length > 0 && (
                          <p className="text-[11px] text-slate-500">
                            <strong>Key Risks:</strong> {latestAISuggestion.futureOutlook.keyRisks.join(" • ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Mandatory One-Line Risk Disclaimer */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-900 leading-snug flex items-center gap-2">
                      <span>⚠️</span>
                      <span>{latestAISuggestion.riskDisclaimer || "Invest at your own risk — market prices and conditions can change, and values may increase or decrease."}</span>
                    </div>

                    {/* Footer / Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#dce7d9] text-[10px] text-[#6c8b72]">
                      <span className="font-semibold text-[#18392c]">
                        Last analyzed: {new Date(latestAISuggestion.createdAt || Date.now()).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {latestAISuggestion.externalContext?.asOfFormatted && (
                        <span>
                          Market Data: {latestAISuggestion.externalContext.goldPricePerGram24K ? `24K Gold ₹${Number(latestAISuggestion.externalContext.goldPricePerGram24K).toLocaleString("en-IN")}/g (${latestAISuggestion.externalContext.goldSource || "Bullion Feeds"} as of ${latestAISuggestion.externalContext.asOfFormatted})` : `As of ${latestAISuggestion.externalContext.asOfFormatted}`}
                        </span>
                      )}
                      <span>
                        Engine: {latestAISuggestion.modelUsed ? `Gemini (${latestAISuggestion.modelUsed})` : "FinanceOS AI Adviser"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="
                      flex
                      flex-col
                      gap-4
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        gap-3
                      "
                    >
                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-[#315c46]
                          text-white
                        "
                      >
                        <FiZap size={18} />
                      </div>

                      <div>
                        <p
                          className="
                            text-sm
                            font-bold
                            text-[#18392c]
                          "
                        >
                          Want an AI suggestion?
                        </p>

                        <p
                          className="
                            mt-1
                            max-w-2xl
                            text-[11px]
                            leading-5
                            text-[#61766a]
                          "
                        >
                          Gemini can analyze your FinanceOS financial data and suggest possible ways to use this maturity amount.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGetAISuggestion}
                      disabled={aiLoading}
                      className="
                        shrink-0
                        rounded-xl
                        bg-[#315c46]
                        px-5
                        py-2.5
                        text-xs
                        font-semibold
                        text-white
                        shadow-sm
                        transition
                        hover:bg-[#18392c]
                        disabled:opacity-60
                        cursor-pointer
                      "
                    >
                      {aiLoading ? (aiLoadingMessage || "Analyzing...") : "Get AI Suggestions"}
                    </button>
                  </div>
                )}

                {/* Error Notice */}
                {aiError && (
                  <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100 flex items-center justify-between">
                    <span>{aiError}</span>
                    <button
                      type="button"
                      onClick={handleGetAISuggestion}
                      className="font-bold underline ml-2 hover:text-red-700"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

            </div>


            {/* ====================================================
                FOOTER
            ==================================================== */}

            <div
              className="
                flex
                shrink-0
                justify-end
                border-t
                border-[#dfe8dc]
                bg-white
                px-5
                py-4
                sm:px-7
              "
            >

              <button
                type="button"
                onClick={
                  closeMaturityActionModal
                }
                className="
                  rounded-xl
                  border
                  border-[#d7e1d5]
                  bg-[#ffffff]
                  px-5
                  py-2.5
                  text-xs
                  font-semibold
                  text-[#52665b]
                  transition
                  hover:bg-[#f4f7f1]
                "
              >
                Cancel
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          RECORD ACTUAL MATURITY MODAL
         ====================================================== */}
      {recordMaturityItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-[#18392c] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2e5241] text-emerald-300">
                    <FiCheckCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Record Investment Maturity</h3>
                    <p className="text-xs text-[#b0c8b6]">{recordMaturityItem.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeRecordMaturityModal}
                  className="rounded-xl p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-[#dfe8dc] bg-[#f7faf5] p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Plan Type</span>
                  <span className="font-bold text-[#18392c]">{recordMaturityItem.type}</span>
                </div>
                {Number(recordMaturityItem.estimatedMaturityAmount || recordMaturityItem.principalAmount || recordMaturityItem.amount || 0) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs border-t border-[#dfe8dc] pt-2">
                    <span className="text-slate-500">Estimated Value</span>
                    <span className="font-bold text-[#315c46]">
                      ₹{formatMoney(recordMaturityItem.estimatedMaturityAmount || recordMaturityItem.principalAmount || recordMaturityItem.amount || 0)}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#18392c]">
                  Actual Maturity Amount Received (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6c8b72]">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={recordActualMaturityValue}
                    onChange={(e) => setRecordActualMaturityValue(e.target.value)}
                    placeholder="Enter actual received amount"
                    className="w-full rounded-xl border border-[#dfe8dc] bg-white py-3 pl-8 pr-3 text-sm font-bold text-[#18392c] outline-none focus:border-[#7da889] focus:ring-2 focus:ring-[#dcebd4]"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Enter the genuine proceeds received from this investment upon closure/maturity.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#18392c]">
                  Maturity Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={recordMaturityDate}
                  onChange={(e) => setRecordMaturityDate(e.target.value)}
                  className="w-full rounded-xl border border-[#dfe8dc] bg-white px-3 py-2.5 text-sm text-[#18392c] outline-none focus:border-[#7da889] focus:ring-2 focus:ring-[#dcebd4]"
                />
              </div>

              <div className="rounded-xl bg-[#edf6e8] p-3 text-xs text-[#2c4e3b] flex items-start gap-2 border border-[#d3e5cd]">
                <FiInfo className="shrink-0 mt-0.5 text-[#315c46]" size={15} />
                <span>
                  After recording actual maturity, you will immediately decide where to allocate these proceeds (Bank, Cash, Purchases, Reinvestment, or Liabilities).
                </span>
              </div>

              {recordMaturityError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
                  {recordMaturityError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRecordMaturityModal}
                  disabled={isRecordingMaturity}
                  className="rounded-xl border border-[#d7e1d5] bg-white px-4 py-2.5 text-xs font-semibold text-[#52665b] hover:bg-[#f4f7f1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRecordMaturity}
                  disabled={isRecordingMaturity}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#18392c] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#244c3b] disabled:opacity-50"
                >
                  {isRecordingMaturity ? (
                    <>
                      <FiRefreshCw className="animate-spin" size={13} />
                      Recording...
                    </>
                  ) : (
                    <>
                      Record & Proceed
                      <FiArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI SUGGESTION DETAILS MODAL */}
      <AISuggestionDetailsModal
        isOpen={isAISuggestionModalOpen}
        suggestion={latestAISuggestion}
        onClose={() => setIsAISuggestionModalOpen(false)}
        onRefresh={handleGetAISuggestion}
        aiLoading={aiLoading}
      />

      {/* ACTION MODAL */}
      <CenteredModal
        isOpen={actionModal.isOpen}
        title={actionModal.title}
        message={actionModal.message}
        type={actionModal.type}
        confirmText={actionModal.confirmText}
        cancelText={actionModal.cancelText}
        confirmVariant={actionModal.confirmVariant}
        onConfirm={actionModal.onConfirm}
        onClose={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>

  );

}


// ============================================================
// OVERVIEW CARD
// ============================================================

function OverviewCard({
  icon,
  title,
  amount,
  count,
  description,
  formatMoney,
}) {

  return (

    <div className="rounded-2xl border border-[#e2e8dc] bg-white p-5">

      <div className="flex items-start justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf6e8] text-[#315c46]">
          {icon}
        </div>

        <span className="rounded-full bg-[#f4f7f1] px-2.5 py-1 text-[10px] font-semibold text-[#5f7568]">
          {count} Active
        </span>

      </div>


      <p className="mt-5 text-xs text-slate-400">
        {title}
      </p>

      <p className="mt-1 text-2xl font-bold text-[#18392c]">
        ₹{formatMoney(
          amount
        )}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {description}
      </p>

    </div>

  );

}


// ============================================================
// SECTION TITLE
// ============================================================

function SectionTitle({
  icon,
  title,
  count,
}) {

  return (

    <div className="flex items-center gap-2 text-[#315c46]">

      {icon}

      <h3 className="text-sm font-semibold text-[#18392c]">
        {title}
      </h3>

      <span className="text-[10px] text-slate-400">
        ({count})
      </span>

    </div>

  );

}


// ============================================================
// INVESTMENT CARD
// ============================================================

function InvestmentCard({
  investment,
  formatMoney,
  updateStatus,
  onPause,
  onResume,
  onMarkMatured,
  deleteItem,
  recordFDInterest,
  recordSIPContribution,
  openMaturityActionModal,
  openRecordMaturityModal,
  onManageReminder,
  onEdit,
}) {

  const status =
    String(
      investment.status ||
      ""
    )
      .trim()
      .toLowerCase();


  const isActive =
    status === "active";

  const isPaused =
    status === "paused";

  const isFinished =
    [
      "completed",
      "matured",
      "closed",
    ].includes(status);


  // ==========================================================
  // TYPE CHECKS
  // ==========================================================

  const investmentType =
    String(
      investment.type ||
      ""
    )
      .trim()
      .toLowerCase();


  const interestMethod =
    String(
      investment.interestMethod ||
      ""
    )
      .trim()
      .toLowerCase();


  const isFixedDeposit =
    investmentType === "fixed deposit" || investmentType === "fd";

  const isPayoutFD =
    interestMethod === "payout";

  const canRecordFDInterest =
    isFixedDeposit &&
    isPayoutFD &&
    isActive;

  const isSIP =
    investmentType === "sip";

  const isRD =
    investmentType === "rd" || investmentType === "recurring deposit";

  const isGold =
    investmentType === "gold";

  const isMutualFund =
    investmentType === "mutual fund";

  const isStocks =
    investmentType === "stocks";

  const canRecordContribution =
    !isFixedDeposit &&
    isActive;


  const principalAmount =
    Number(
      investment.principalAmount ||
      investment.amount ||
      0
    );


  const totalInterestReceived =
    Number(
      investment.totalInterestReceived ||
      0
    );

  const isMatured =
    status === "matured" ||
    investment.status?.toLowerCase() === "matured" ||
    investment.maturityAllocationStatus === "Fully Allocated" ||
    (Number(investment.maturityAllocatedAmount) > 0 && Number(investment.maturityRemainingAmount) <= 0);

  // 1. Authoritative Target / Committed Amount
  let targetAmount = Number(investment.estimatedMaturityAmount || 0);

  if (targetAmount === 0 && investment.startDate && investment.maturityDate && investment.monthlyContribution) {
    const start = new Date(investment.startDate);
    const end = new Date(investment.maturityDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
      if (months > 0) {
        targetAmount = months * Number(investment.monthlyContribution);
      }
    }
  }

  if (targetAmount === 0) {
    targetAmount = Number(
      investment.targetAmount ||
      investment.actualMaturityValue ||
      investment.currentValue ||
      investment.amount ||
      investment.principalAmount ||
      0
    );
  }

  // 2. Authoritative Contributed / Allocated Amount
  const paidSipContribs = (investment.sipContributions || [])
    .filter((c) => c.status === "Paid")
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  let contributedAmount = 0;
  if (isMatured) {
    contributedAmount = targetAmount > 0 ? targetAmount : Number(investment.actualMaturityValue || investment.amount || investment.principalAmount || 0);
  } else if (isFixedDeposit || investment.contributionType === "One Time") {
    contributedAmount = Number(investment.principalAmount || investment.amount || 0);
  } else if (paidSipContribs > 0) {
    contributedAmount = paidSipContribs;
  } else if (Number(investment.totalContributions) > 0) {
    contributedAmount = Number(investment.totalContributions);
  } else if (Number(investment.totalInvested) > 0) {
    contributedAmount = Number(investment.totalInvested);
  } else {
    // For active recurring commitments with zero recorded contributions, contributed is strictly 0!
    contributedAmount = 0;
  }

  // 3. Authoritative Remaining & Progress Percentage
  let remainingContribution = 0;
  let progressPercentage = 0;

  if (isMatured) {
    progressPercentage = 100;
    remainingContribution = 0;
    if (contributedAmount <= 0) contributedAmount = targetAmount;
  } else if (isFixedDeposit || investment.contributionType === "One Time") {
    progressPercentage = 100;
    remainingContribution = 0;
  } else {
    if (targetAmount > 0) {
      progressPercentage = Math.min(100, Math.max(0, (contributedAmount / targetAmount) * 100));
      remainingContribution = Math.max(0, targetAmount - contributedAmount);
    } else if (contributedAmount > 0) {
      progressPercentage = 100;
      targetAmount = contributedAmount;
      remainingContribution = 0;
    } else {
      progressPercentage = 0;
      remainingContribution = targetAmount;
    }
  }

  if (!Number.isFinite(progressPercentage)) {
    progressPercentage = 0;
  }

  const monthlyEquivalent = isFixedDeposit || investment.contributionType === "One Time"
    ? 0
    : Number(investment.monthlyContribution || (isSIP ? investment.amount : 0) || 0);

  return (

    <div className="rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-5">

      <CardHeader
        type={
          investment.type ||
          "Investment"
        }
        name={
          investment.name ||
          "Investment"
        }
        status={
          investment.status
        }
      />


      <div className="mt-4 grid grid-cols-2 gap-3">

        <InfoBox
          label={
            isFixedDeposit
              ? "Principal Amount"
              : "Amount"
          }
          value={`₹${formatMoney(
            principalAmount
          )}`}
        />


        <InfoBox
          label="Contribution Type"
          value={
            investment.contributionType ||
            "—"
          }
        />


        <InfoBox
          label="Monthly Equivalent"
          value={`₹${formatMoney(
            monthlyEquivalent
          )}`}
        />


        <InfoBox
          label="Frequency"
          value={
            investment.frequency ||
            "—"
          }
        />

      </div>


      {/* ======================================================
          CONTRIBUTION PROGRESS (FOR NON-FD)
         ====================================================== */}

      {!isFixedDeposit && targetAmount > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400">Contribution Progress</p>
            <p className="text-[10px] font-semibold text-[#52665b]">
              {progressPercentage.toFixed(0)}%
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe8da]">
            <div
              className="h-full rounded-full bg-[#315c46] transition-all duration-300"
              style={{ width: `${progressPercentage.toFixed(0)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>Contributed: <strong className="text-[#18392c]">₹{formatMoney(contributedAmount)}</strong></span>
            <span>Remaining: <strong className="text-[#18392c]">₹{formatMoney(remainingContribution)}</strong></span>
          </div>
        </div>
      )}

      {/* ======================================================
          GOLD DETAILS
         ====================================================== */}

      {isGold && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Gold Details
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-slate-700 font-medium">
            {(investment.purity || investment.customDetails?.purity) && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                Purity: {investment.purity || investment.customDetails?.purity}
              </span>
            )}
            {(investment.weight || investment.customDetails?.weight) && (
              <span>Weight: <strong className="text-[#18392c]">{investment.weight || investment.customDetails?.weight}g</strong></span>
            )}
            {(investment.goldType || investment.customDetails?.goldType) && (
              <span>Type: <strong className="text-[#18392c]">{investment.goldType || investment.customDetails?.goldType}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          STOCKS DETAILS
         ====================================================== */}

      {isStocks && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
            Stock Holding Info
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-slate-700 font-medium">
            {(investment.symbol || investment.ticker || investment.customDetails?.symbol || investment.customDetails?.ticker) && (
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">
                {investment.symbol || investment.ticker || investment.customDetails?.symbol || investment.customDetails?.ticker}
              </span>
            )}
            {(investment.quantity || investment.customDetails?.quantity) && (
              <span>Qty: <strong className="text-[#18392c]">{investment.quantity || investment.customDetails?.quantity}</strong></span>
            )}
            {(investment.purchasePrice || investment.customDetails?.purchasePrice) && (
              <span>Avg Buy: <strong className="text-[#18392c]">₹{formatMoney(investment.purchasePrice || investment.customDetails?.purchasePrice)}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          MUTUAL FUND DETAILS
         ====================================================== */}

      {isMutualFund && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Mutual Fund Scheme
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-slate-700 font-medium">
            {(investment.schemeName || investment.fundName || investment.customDetails?.schemeName || investment.customDetails?.fundName) && (
              <span className="font-semibold text-[#18392c]">
                {investment.schemeName || investment.fundName || investment.customDetails?.schemeName || investment.customDetails?.fundName}
              </span>
            )}
            {(investment.units || investment.customDetails?.units) && (
              <span>Units: <strong className="text-[#18392c]">{investment.units || investment.customDetails?.units}</strong></span>
            )}
          </div>
        </div>
      )}


      {/* ======================================================
          FIXED DEPOSIT DETAILS
         ====================================================== */}

      {isFixedDeposit && (

        <div className="mt-4 rounded-xl border border-[#dcebd4] bg-[#f4faef] p-4">

          <div className="flex items-start justify-between gap-4">

            <div>

              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                Fixed Deposit
              </p>

              <p className="mt-1 text-xs font-semibold text-[#18392c]">

                {investment.interestMethod ||
                  "Interest method not set"}

              </p>

            </div>


            {Number(
              investment.interestRate ||
              0
            ) > 0 && (

              <div className="text-right">

                <p className="text-[10px] text-slate-400">
                  Interest Rate
                </p>

                <p className="mt-1 text-sm font-bold text-[#315c46]">

                  {investment.interestRate}% p.a.

                </p>

              </div>

            )}

          </div>


          {investment.institution && (

            <div className="mt-3 border-t border-[#dce5d7] pt-3">

              <p className="text-[10px] text-slate-400">
                Bank / Institution
              </p>

              <p className="mt-1 text-xs font-semibold text-[#52665b]">
                {investment.institution}
              </p>

            </div>

          )}


          {isPayoutFD && (

            <div className="mt-3 border-t border-[#dce5d7] pt-3">

              <p className="text-[10px] text-slate-400">
                Interest Payout
              </p>

              <p className="mt-1 text-xs font-semibold text-[#52665b]">

                {investment.interestPayoutFrequency ||
                  "Not specified"}

              </p>

            </div>

          )}


          {isPayoutFD &&
            totalInterestReceived > 0 && (

            <div className="mt-3">

              <p className="text-[10px] text-slate-400">
                Interest Received
              </p>

              <p className="mt-1 text-sm font-bold text-[#315c46]">

                ₹{formatMoney(
                  totalInterestReceived
                )}

              </p>

            </div>

          )}


          {!isPayoutFD && (

            <p className="mt-3 border-t border-[#dce5d7] pt-3 text-[10px] leading-4 text-[#6c8b72]">

              Cumulative interest remains in the FD
              and is included in the maturity value.

            </p>

          )}

        </div>

      )}


      {/* ======================================================
          DATES
         ====================================================== */}

      <div className="mt-4 border-t border-[#e7ece3] pt-3 text-[10px] text-slate-400">

        <p>
          Start:{" "}
          <span className="font-medium text-[#52665b]">
            {investment.startDate ||
              "Not set"}
          </span>
        </p>


        {investment.maturityDate && (

          <p className="mt-1">

            Maturity:{" "}

            <span className="font-medium text-[#52665b]">
              {investment.maturityDate}
            </span>

          </p>

        )}

      </div>


      {investment.reminder?.enabled && (

        <ReminderBadge
          text="Contribution Reminder On"
          onClick={onManageReminder ? () => onManageReminder(investment) : undefined}
        />

      )}


      {/* ======================================================
          MATURITY ALLOCATION SUMMARY (FOR MATURED PLANS)
         ====================================================== */}

      {status === "matured" && (
        <div className="mt-4 rounded-xl border border-[#d6e3d2] bg-[#f4f8f1] p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-[#18392c]">Maturity Amount:</span>
            <span className="font-bold text-[#18392c]">
              ₹{formatMoney(
                investment.actualMaturityValue ||
                investment.estimatedMaturityAmount ||
                investment.currentValue ||
                investment.amount ||
                0
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#4d6657] mb-1">
            <span>Allocated:</span>
            <span className="font-medium text-[#2d523e]">
              ₹{formatMoney(investment.maturityAllocatedAmount || 0)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#4d6657] mb-2">
            <span>Remaining:</span>
            <span className="font-bold text-[#18392c]">
              ₹{formatMoney(
                investment.maturityRemainingAmount !== undefined && investment.maturityRemainingAmount !== null
                  ? investment.maturityRemainingAmount
                  : Math.max(
                      0,
                      (Number(investment.actualMaturityValue || investment.currentValue || investment.amount || 0) -
                        Number(investment.maturityAllocatedAmount || 0))
                    )
              )}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t border-[#e2ece0]">
            <span className="text-[10px] uppercase tracking-wider text-[#698572] font-semibold">
              Allocation Status:
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                (investment.maturityRemainingAmount <= 0 && (investment.maturityAllocatedAmount || 0) > 0) ||
                investment.maturityAllocationStatus === "Fully Allocated"
                  ? "bg-[#dcf3db] text-[#1b5e20]"
                  : (investment.maturityAllocatedAmount || 0) > 0
                  ? "bg-[#fff3cd] text-[#856404]"
                  : "bg-[#e8ece6] text-[#495b50]"
              }`}
            >
              {investment.maturityAllocationStatus ||
                ((investment.maturityRemainingAmount <= 0 && (investment.maturityAllocatedAmount || 0) > 0)
                  ? "Fully Allocated"
                  : (investment.maturityAllocatedAmount || 0) > 0
                  ? "Partially Allocated"
                  : "Pending Allocation")}
            </span>
          </div>
        </div>
      )}

      {/* MATURITY DUE ALERT */}
      {!isFinished &&
        investment.maturityDate &&
        new Date(investment.maturityDate).getTime() <= new Date().setHours(23, 59, 59, 999) && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-1.5 font-semibold">
              <FiCheckCircle className="text-amber-600" size={14} />
              <span>Maturity Date Reached!</span>
            </div>
            <button
              type="button"
              onClick={() => openRecordMaturityModal(investment)}
              className="rounded-lg bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-800 transition"
            >
              Record Maturity
            </button>
          </div>
        )}

      {/* CONFIGURED PREFERENCE TAG */}
      {investment.afterMaturityAction && investment.afterMaturityAction !== "MANUAL_DECIDE" && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#4d6b57]">
          <span className="font-semibold">Maturity Preference:</span>
          <span className="rounded-md bg-[#eaf3e7] px-1.5 py-0.5 text-[10px] font-bold text-[#2d523e]">
            {investment.afterMaturityAction === "BANK_SAVINGS"
              ? "Bank Savings"
              : investment.afterMaturityAction === "RENEW_FULL"
              ? "Auto-Renew"
              : investment.afterMaturityAction === "KEEP_CASH"
              ? "Keep as Cash"
              : investment.afterMaturityAction === "NEW_INVESTMENT"
              ? "Reinvest"
              : investment.afterMaturityAction === "PAY_LIABILITY"
              ? "Pay Liability"
              : investment.afterMaturityAction}
          </span>
        </div>
      )}

      {/* ======================================================
          ACTIONS
         ====================================================== */}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e7ece3] pt-4">


        {/* RECORD FD INTEREST */}

        {canRecordFDInterest && (

          <ActionButton
            icon={
              <span className="font-bold text-xs">₹</span>
            }
            text="Record Interest"
            primary
            onClick={() =>
              recordFDInterest(
                investment
              )
            }
          />

        )}


        {/* EDIT INVESTMENT */}
        {onEdit && (
          <ActionButton
            icon={<FiEdit2 />}
            text="Edit"
            onClick={() => onEdit(investment)}
          />
        )}

        {/* RECORD CONTRIBUTION */}
        {canRecordContribution && (
          <ActionButton
            icon={<span className="font-bold text-xs">₹</span>}
            text={
              isSIP
                ? "Record Contribution"
                : isRD
                ? "Record Installment"
                : isGold
                ? "Add Gold / Payment"
                : isStocks
                ? "Add Stock / Purchase"
                : "Record Contribution"
            }
            primary
            onClick={() => recordSIPContribution(investment)}
          />
        )}


        {/* PAUSE */}

        {isActive && (

          <ActionButton
            icon={
              <FiPause />
            }
            text="Pause"
            onClick={() =>
              onPause ? onPause(investment) : updateStatus(
                investment.id,
                "Paused"
              )
            }
          />

        )}


        {/* RESUME */}

        {isPaused && (

          <ActionButton
            icon={
              <FiPlay />
            }
            text="Resume"
            onClick={() =>
              onResume ? onResume(investment) : updateStatus(
                investment.id,
                "Active"
              )
            }
          />

        )}


        {/* MARK MATURED */}

        {!isFinished && (

          <ActionButton
            icon={
              <FiCheckCircle />
            }
            text="Mark Matured"
            onClick={() =>
              onMarkMatured ? onMarkMatured(investment) : openRecordMaturityModal(
                investment
              )
            }
          />

        )}


        {/* MATURITY OPTIONS / ALLOCATE */}

        {status === "matured" && (

          <ActionButton
            icon={
              (investment.maturityRemainingAmount <= 0 && (investment.maturityAllocatedAmount || 0) > 0) ||
              investment.maturityAllocationStatus === "Fully Allocated"
                ? <FiList />
                : <FiRefreshCw />
            }
            text={
              !investment.actualMaturityValue || investment.actualMaturityValue <= 0
                ? "Record Actual Maturity"
                : (investment.maturityRemainingAmount <= 0 && (investment.maturityAllocatedAmount || 0) > 0) ||
                  investment.maturityAllocationStatus === "Fully Allocated"
                ? "View Allocation Details"
                : "Allocate Maturity"
            }
            primary
            onClick={() => {
              if (!investment.actualMaturityValue || investment.actualMaturityValue <= 0) {
                openRecordMaturityModal(investment);
              } else {
                openMaturityActionModal(investment);
              }
            }}
          />

        )}


        {/* REMINDER */}
        <ActionButton
          icon={<FiBell />}
          text={investment.reminder?.enabled ? "Reminder" : "Set Reminder"}
          onClick={() => onManageReminder && onManageReminder(investment)}
        />

        {/* DELETE */}

        <DeleteButton
          onClick={() =>
            deleteItem(
              investment
            )
          }
        />

      </div>

    </div>

  );

}


// ============================================================
// INSURANCE CARD
// ============================================================

function InsuranceCard({
  policy,
  formatMoney,
  updateStatus,
  onPause,
  onResume,
  deleteItem,
  onViewDetails,
  onManageReminder,
}) {

  const isActive =
    policy.status === "Active";

  const isPaused =
    policy.status === "Paused";

  const isFinished =
    [
      "Completed",
      "Matured",
      "Closed",
    ].includes(
      policy.status
    );


  return (

    <div className="rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-5">

      <CardHeader
        type={
          policy.type ||
          "Insurance"
        }
        name={
          policy.name ||
          "Insurance Policy"
        }
        status={
          policy.status
        }
      />


      {policy.policyNumber && (

        <p className="mt-2 text-[10px] text-slate-400">

          Policy No:{" "}

          <span className="font-medium text-[#52665b]">
            {policy.policyNumber}
          </span>

        </p>

      )}


      <div className="mt-4 grid grid-cols-2 gap-3">

        <InfoBox
          label="Premium"
          value={`₹${formatMoney(
            policy.premiumAmount
          )}`}
        />

        <InfoBox
          label="Frequency"
          value={
            policy.premiumFrequency ||
            "—"
          }
        />


        <div className="col-span-2">

          <InfoBox
            label="Monthly Premium Equivalent"
            value={`₹${formatMoney(
              policy.monthlyPremium
            )}`}
          />

        </div>

      </div>


      <div className="mt-4 border-t border-[#e7ece3] pt-3 text-[10px] text-slate-400">

        <p>
          Start:{" "}
          <span className="font-medium text-[#52665b]">
            {policy.startDate ||
              "Not set"}
          </span>
        </p>


        {policy.nextPremiumDate && (

          <p className="mt-1">

            Next Premium:{" "}

            <span className="font-medium text-[#52665b]">
              {policy.nextPremiumDate}
            </span>

          </p>

        )}


        {policy.maturityDate && (

          <p className="mt-1">

            Maturity / Expiry:{" "}

            <span className="font-medium text-[#52665b]">
              {policy.maturityDate}
            </span>

          </p>

        )}

        {/* Dynamic Metadata Render */}
        {policy.metadata && Object.keys(policy.metadata).length > 0 && (
          <div className="mt-2 border-t border-[#edf0e9] pt-2">
            <span className="font-semibold text-[#18392c]">Details:</span>
            {Object.entries(policy.metadata).map(([key, value]) => {
              if (!value) return null;
              // format key camelCase to Title Case
              const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return (
                <p key={key} className="mt-1">
                  {formattedKey}:{" "}
                  <span className="font-medium text-[#52665b]">
                    {key.toLowerCase().includes('amount') ? `₹${formatMoney(value)}` : value}
                  </span>
                </p>
              );
            })}
          </div>
        )}

      </div>


      {policy.paymentReminder?.enabled && (

        <ReminderBadge
          text="Premium Reminder On"
          onClick={onManageReminder ? () => onManageReminder(policy) : undefined}
        />

      )}


      {policy.maturityReminder?.enabled && (

        <ReminderBadge
          text="Maturity Reminder On"
          onClick={onManageReminder ? () => onManageReminder(policy) : undefined}
        />

      )}


      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e7ece3] pt-4">

        <ActionButton
          icon={
            <FiList />
          }
          text="View Details"
          onClick={onViewDetails}
        />

        {isActive && (

          <ActionButton
            icon={
              <FiPause />
            }
            text="Pause"
            onClick={() =>
              onPause ? onPause(policy) : updateStatus(
                policy.id,
                "Paused"
              )
            }
          />

        )}


        {isPaused && (

          <ActionButton
            icon={
              <FiPlay />
            }
            text="Resume"
            onClick={() =>
              onResume ? onResume(policy) : updateStatus(
                policy.id,
                "Active"
              )
            }
          />

        )}


        {!isFinished && (

          <ActionButton
            icon={
              <FiCheckCircle />
            }
            text="Mark Matured"
            onClick={() =>
              updateStatus(
                policy.id,
                "Matured"
              )
            }
          />

        )}


        {/* REMINDER */}
        <ActionButton
          icon={<FiBell />}
          text={policy.reminder?.enabled ? "Reminder" : "Set Reminder"}
          onClick={() => onManageReminder && onManageReminder(policy)}
        />

        <DeleteButton
          onClick={() =>
            deleteItem(
              policy
            )
          }
        />

      </div>

    </div>

  );

}


// ============================================================
// LIABILITY CARD
// ============================================================

function LiabilityCard({
  liability,
  formatMoney,
  updateStatus,
  onPause,
  onResume,
  onCloseLiability,
  deleteItem,
  recordPayment,
  onViewDetails,
  onManageReminder,
}) {

  const original =
    Number(
      liability.originalAmount ||
      liability.principalAmount ||
      liability.amount ||
      liability.totalAmount ||
      0
    );

  const remaining =
    Number(
      liability.remainingAmount !== undefined && liability.remainingAmount !== null
        ? liability.remainingAmount
        : Math.max(0, original - (liability.paidAmount || 0))
    );

  const isActive =
    liability.status === "Active";

  const isPaused =
    liability.status === "Paused";

  const isCompleted =
    liability.status === "Completed";

  const isClosed =
    liability.status === "Closed";

  const isFinished = isCompleted || isClosed;

  const paid =
    isFinished
      ? original
      : Math.max(
          original - remaining,
          0
        );

  const paidPercentage =
    isFinished
      ? 100
      : (original > 0
          ? Math.min(
              (
                paid /
                original
              ) * 100,
              100
            )
          : 0);


  return (

    <div className="rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-5">

      <CardHeader
        type={
          liability.type ||
          "Liability"
        }
        name={
          liability.name ||
          "Liability"
        }
        status={
          liability.status
        }
      />


      <div className="mt-4 grid grid-cols-2 gap-3">

        <InfoBox
          label="Original Amount"
          value={`₹${formatMoney(
            original
          )}`}
        />

        <InfoBox
          label="Remaining"
          value={`₹${formatMoney(
            remaining
          )}`}
        />

        <InfoBox
          label={
            liability.type ===
            "Credit Card"
              ? "Monthly Payment"
              : "Monthly EMI"
          }
          value={`₹${formatMoney(
            liability.monthlyEMI
          )}`}
        />

        <InfoBox
          label="Paid"
          value={`${paidPercentage.toFixed(
            0
          )}%`}
        />

      </div>


      {/* PROGRESS */}

      <div className="mt-4">

        <div className="flex items-center justify-between">

          <p className="text-[10px] text-slate-400">
            Repayment Progress
          </p>

          <p className="text-[10px] font-semibold text-[#52665b]">

            ₹{formatMoney(
              paid
            )} paid

          </p>

        </div>


        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dfe8da]">

          <div
            className="h-full rounded-full bg-[#315c46] transition-all"
            style={{
              width:
                `${paidPercentage}%`,
            }}
          />

        </div>

      </div>


      {/* DATES */}

      <div className="mt-4 border-t border-[#e7ece3] pt-3">

        <div className="flex items-center gap-2 text-[10px] text-slate-400">

          <FiCalendar />

          <span>

            Start:{" "}

            <span className="font-medium text-[#52665b]">
              {liability.startDate ||
                "Not set"}
            </span>

          </span>

        </div>


        {liability.nextDueDate && (

          <p className="mt-2 text-[10px] text-slate-400">

            Next Payment:{" "}

            <span className="font-medium text-[#52665b]">
              {liability.nextDueDate}
            </span>

          </p>

        )}


        {liability.endDate && (

          <p className="mt-1 text-[10px] text-slate-400">

            Expected End:{" "}

            <span className="font-medium text-[#52665b]">
              {liability.endDate}
            </span>

          </p>

        )}

      </div>


      {liability.reminder?.enabled && (

        <ReminderBadge
          text="Payment Reminder On"
          onClick={onManageReminder ? () => onManageReminder(liability) : undefined}
        />

      )}


      {/* ACTIONS */}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e7ece3] pt-4">

        <ActionButton
          icon={<FiEye />}
          text="View Details"
          onClick={onViewDetails}
        />

        {!isCompleted &&
          !isClosed &&
          remaining > 0 && (

          <ActionButton
            icon={
              <span className="font-bold text-xs">₹</span>
            }
            text="Record Payment"
            primary
            onClick={() =>
              recordPayment(
                liability
              )
            }
          />

        )}


        {isActive && (

          <ActionButton
            icon={
              <FiPause />
            }
            text="Pause"
            onClick={() =>
              onPause ? onPause(liability) : updateStatus(
                liability._id || liability.id,
                "Paused"
              )
            }
          />

        )}


        {isPaused && (

          <ActionButton
            icon={
              <FiPlay />
            }
            text="Resume"
            onClick={() =>
              onResume ? onResume(liability) : updateStatus(
                liability._id || liability.id,
                "Active"
              )
            }
          />

        )}


        {!isCompleted &&
          !isClosed && (

          <ActionButton
            icon={
              <FiCheckCircle />
            }
            text="Close"
            onClick={() => {
              if (onCloseLiability) {
                onCloseLiability(liability);
              } else {
                updateStatus(
                  liability._id || liability.id,
                  "Closed"
                );
              }
            }}
          />

        )}


        {/* REMINDER */}
        <ActionButton
          icon={<FiBell />}
          text={liability.reminder?.enabled ? "Reminder" : "Set Reminder"}
          onClick={() => onManageReminder && onManageReminder(liability)}
        />

        <DeleteButton
          onClick={() =>
            deleteItem(
              liability
            )
          }
        />

      </div>

    </div>

  );

}


// ============================================================
// CARD HEADER
// ============================================================

function CardHeader({
  type,
  name,
  status,
}) {

  return (

    <div className="flex items-start justify-between gap-4">

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6c8b72]">
          {type}
        </p>

        <h4 className="mt-1 text-sm font-bold text-[#18392c]">
          {name}
        </h4>

      </div>


      <StatusBadge
        status={
          status
        }
      />

    </div>

  );

}


// ============================================================
// INFO BOX
// ============================================================

function InfoBox({
  label,
  value,
}) {

  return (

    <div className="rounded-lg bg-white p-3">

      <p className="text-[10px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-[#18392c]">
        {value}
      </p>

    </div>

  );

}


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  status = "Active",
}) {

  let classes =
    "bg-[#e5f3dc] text-[#315c46]";


  if (
    status === "Paused"
  ) {

    classes =
      "bg-amber-50 text-amber-600";

  }


  if (
    status === "Completed"
  ) {

    classes =
      "bg-blue-50 text-blue-600";

  }


  if (
    status === "Matured"
  ) {

    classes =
      "bg-purple-50 text-purple-600";

  }


  if (
    status === "Closed"
  ) {

    classes =
      "bg-slate-200 text-slate-500";

  }


  return (

    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${classes}`}
    >
      {status}
    </span>

  );

}


// ============================================================
// REMINDER BADGE
// ============================================================

function ReminderBadge({
  text,
  onClick,
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#e8f4e2] px-3 py-1 text-[10px] font-semibold text-[#315c46] hover:bg-[#d8edd0] transition cursor-pointer border border-[#cbe4c1]"
        title="Click to manage reminder"
      >
        <FiBell className="text-[11px]" />
        {text}
      </button>
    );
  }

  return (
    <div className="mt-3 inline-flex rounded-full bg-[#e8f4e2] px-2.5 py-1 text-[10px] font-semibold text-[#315c46]">
      {text}
    </div>
  );
}


// ============================================================
// ACTION BUTTON
// ============================================================

function ActionButton({
  icon,
  text,
  onClick,
  primary = false,
}) {

  return (

    <button
      type="button"
      onClick={
        onClick
      }
      className={
        primary
          ? "flex items-center gap-1.5 rounded-lg bg-[#18392c] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#244c3b]"
          : "flex items-center gap-1.5 rounded-lg border border-[#dfe6da] bg-white px-3 py-2 text-[11px] font-semibold text-[#52665b] transition hover:bg-[#f2f6ef]"
      }
    >

      {icon}
      {text}

    </button>

  );

}


// ============================================================
// DELETE BUTTON
// ============================================================

function DeleteButton({
  onClick,
}) {

  return (

    <button
      type="button"
      onClick={
        onClick
      }
      className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-2 text-[11px] font-semibold text-red-500 transition hover:bg-red-50"
    >

      <FiTrash2 />

      Delete

    </button>

  );

}


// ============================================================
// PAYMENT MODAL
// ============================================================

function PaymentModal({
  liability,
  paymentAmount,
  setPaymentAmount,
  error,
  formatMoney,
  onSubmit,
  onClose,
  selectedMonth,
}) {
  const monthBounds = parseSelectedMonth(selectedMonth);
  const storedDueDay = liability?.dueDay
    || (liability?.nextDueDate ? new Date(liability.nextDueDate).getDate() : 5);
  const derivedDueDateISO = formatDateISO(
    calculateDueDateForMonth(storedDueDay, monthBounds.year, monthBounds.month)
  );

  const remaining =
    Number(
      liability.remainingAmount ||
      0
    );


  const enteredAmount =
    Number(
      paymentAmount ||
      0
    );


  const actualPayment =
    Math.min(
      Math.max(
        enteredAmount,
        0
      ),
      remaining
    );


  const newRemaining =
    Math.max(
      remaining -
      actualPayment,
      0
    );


  return (

    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">

      <div className="w-full max-w-md rounded-2xl border border-[#e2e8dc] bg-white shadow-xl">


        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-[#edf0e9] p-5">

          <div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6c8b72]">
              Liability Payment
            </p>

            <h2 className="mt-1 text-lg font-bold text-[#18392c]">
              Record Payment
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {liability.name}
            </p>

          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f4f7f1]"
          >

            <FiX />

          </button>

        </div>


        {/* FORM */}

        <form
          onSubmit={
            onSubmit
          }
          className="p-5"
        >

          {/* CURRENT BALANCE */}

          <div className="rounded-xl bg-[#fafcf8] p-4">

            <p className="text-[10px] text-slate-400">
              Current Remaining Balance
            </p>

            <p className="mt-1 text-xl font-bold text-[#18392c]">

              ₹{formatMoney(
                remaining
              )}

            </p>

            <p className="mt-1 text-[10px] text-slate-400">

              Expected monthly payment: ₹
              {formatMoney(
                liability.monthlyEMI
              )}

            </p>

          </div>


          {/* SCHEDULED DUE DATE (READ-ONLY) */}

          <div className="mt-4">

            <label className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
              <FiLock size={11} className="text-amber-500" />
              Scheduled Due Date (Auto)
            </label>

            <input
              type="text"
              readOnly
              value={formatDateDisplay(derivedDueDateISO)}
              title={`Automatically derived from EMI due day ${storedDueDay} for ${monthBounds.formatted}`}
              className="mt-1.5 w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] py-2.5 px-4 text-sm font-semibold text-[#18392c] cursor-not-allowed"
            />

            <p className="mt-1 text-[10px] text-[#8fa895]">
              Day {storedDueDay} of {monthBounds.formatted}
            </p>

          </div>


          {/* PAYMENT */}

          <div className="mt-5">

            <label className="text-xs font-semibold text-[#52665b]">
              Payment Amount
            </label>


            <div className="relative mt-2">

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                ₹
              </span>

              <input
                type="number"
                min="1"
                value={
                  paymentAmount
                }
                onChange={(event) =>
                  setPaymentAmount(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] py-3 pl-9 pr-4 text-sm text-[#18392c] outline-none focus:border-[#9fbd8d]"
              />

            </div>


            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              You can enter the actual amount paid.
              It does not have to equal the regular EMI.
            </p>

          </div>


          {/* PREVIEW */}

          {enteredAmount > 0 && (

            <div className="mt-5 rounded-xl border border-[#dcebd4] bg-[#f4faef] p-4">

              <div className="flex justify-between gap-4">

                <div>

                  <p className="text-[10px] text-[#6c8b72]">
                    Payment Applied
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#315c46]">

                    ₹{formatMoney(
                      actualPayment
                    )}

                  </p>

                </div>


                <div className="text-right">

                  <p className="text-[10px] text-[#6c8b72]">
                    New Balance
                  </p>

                  <p className="mt-1 text-sm font-bold text-[#18392c]">

                    ₹{formatMoney(
                      newRemaining
                    )}

                  </p>

                </div>

              </div>


              {enteredAmount >
                remaining && (

                <p className="mt-3 text-[10px] leading-4 text-amber-600">

                  The entered amount is higher than
                  the remaining balance. FinanceOS will
                  apply only ₹{formatMoney(
                    remaining
                  )} to this liability.

                </p>

              )}


              {newRemaining === 0 && (

                <p className="mt-3 text-[10px] font-semibold text-[#315c46]">
                  This payment will complete the liability.
                </p>

              )}

            </div>

          )}


          {/* ERROR */}

          {error && (

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">

              <p className="text-xs text-red-600">
                {error}
              </p>

            </div>

          )}


          {/* BUTTONS */}

          <div className="mt-6 flex justify-end gap-3 border-t border-[#edf0e9] pt-5">

            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-xl border border-[#dfe6da] px-4 py-2.5 text-xs font-semibold text-[#52665b]"
            >
              Cancel
            </button>


            <button
              type="submit"
              className="rounded-xl bg-[#18392c] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Record Payment
            </button>

          </div>

        </form>

      </div>

    </div>

  );

}


// ============================================================
// EXPORT
// ============================================================

export default PlansCommitments;