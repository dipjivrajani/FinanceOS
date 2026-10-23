// ============================================================
// FINANCEOS - INVESTMENT FORM
// ============================================================

import { useMemo, useState } from "react";
import { FiX, FiTrendingUp, FiCalendar, FiBell, FiDollarSign, FiCheck, FiRefreshCw, FiCreditCard, FiBarChart2 } from "react-icons/fi";
import useFinance from "../../context/useFinance.js";
import CenteredModal from "../common/CenteredModal.jsx";

// ============================================================
// INPUT STYLE
// ============================================================

const inputClass =
  "mt-2 w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-4 py-3 text-sm text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d] focus:ring-2 focus:ring-[#9fbd8d]/10";

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(amount) {
  return safeNumber(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateYears(startDate, maturityDate) {
  if (!startDate || !maturityDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const maturity = new Date(`${maturityDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(maturity.getTime()) ||
    maturity <= start
  ) {
    return 0;
  }

  const milliseconds = maturity.getTime() - start.getTime();
  const days = milliseconds / (1000 * 60 * 60 * 24);
  return days / 365.2425;
}

function getCompoundingPeriods(frequency) {
  switch (frequency) {
    case "Monthly": return 12;
    case "Quarterly": return 4;
    case "Half Yearly": return 2;
    case "Yearly": return 1;
    default: return 4;
  }
}

function getPayoutsPerYear(frequency) {
  switch (frequency) {
    case "Monthly": return 12;
    case "Quarterly": return 4;
    case "Half Yearly": return 2;
    case "Yearly": return 1;
    default: return 1;
  }
}

function calculateFDDetails({
  principal,
  interestRate,
  interestMethod,
  payoutFrequency,
  compoundingFrequency,
  startDate,
  maturityDate,
}) {
  const principalAmount = safeNumber(principal);
  const rate = safeNumber(interestRate);
  const years = calculateYears(startDate, maturityDate);

  if (principalAmount <= 0 || rate <= 0 || years <= 0) {
    return {
      durationYears: 0,
      estimatedInterest: 0,
      estimatedMaturityAmount: principalAmount,
      estimatedInterestPerPayout: 0,
      estimatedAnnualInterest: 0,
    };
  }

  const annualRate = rate / 100;

  if (interestMethod === "Payout") {
    const estimatedAnnualInterest = principalAmount * annualRate;
    const payoutsPerYear = getPayoutsPerYear(payoutFrequency);
    const estimatedInterestPerPayout = estimatedAnnualInterest / payoutsPerYear;
    const estimatedInterest = estimatedAnnualInterest * years;

    return {
      durationYears: years,
      estimatedInterest,
      estimatedMaturityAmount: principalAmount,
      estimatedInterestPerPayout,
      estimatedAnnualInterest,
    };
  }

  const periods = getCompoundingPeriods(compoundingFrequency);
  const maturityAmount =
    principalAmount * Math.pow(1 + annualRate / periods, periods * years);
  const estimatedInterest = maturityAmount - principalAmount;

  return {
    durationYears: years,
    estimatedInterest,
    estimatedMaturityAmount: maturityAmount,
    estimatedInterestPerPayout: 0,
    estimatedAnnualInterest: principalAmount * annualRate,
  };
}

// ============================================================
// RD CALCULATION
// Standard RD Maturity Formula:
//   M = P × n + P × n × (n+1) / 2 × r / 1200
// Where P = monthly deposit, n = number of months, r = annual rate %
// (Simple interest approximation used by most Indian banks)
// ============================================================

function calculateRDDetails({ depositAmount, interestRate, startDate, maturityDate }) {
  const P = safeNumber(depositAmount);
  const r = safeNumber(interestRate);
  const years = calculateYears(startDate, maturityDate);
  const n = Math.round(years * 12); // number of months

  if (P <= 0 || r <= 0 || n <= 0) {
    return {
      months: n,
      totalDeposits: P * Math.max(n, 0),
      estimatedInterest: 0,
      estimatedMaturityAmount: P * Math.max(n, 0),
    };
  }

  const totalDeposits = P * n;
  // Standard quarterly compounding RD formula used by most banks
  // Interest = P × n(n+1)/2 × r / (1200)
  const estimatedInterest = (P * n * (n + 1) * r) / (2 * 1200);
  const estimatedMaturityAmount = totalDeposits + estimatedInterest;

  return {
    months: n,
    totalDeposits,
    estimatedInterest,
    estimatedMaturityAmount,
  };
}

function calculateNextContributionDate(startDate, contributionDay) {
  if (!startDate || !contributionDay) return "";
  const [year, month, day] = startDate.split("-").map(Number);
  const selectedDay = Math.min(Math.max(Number(contributionDay), 1), 28);
  const start = new Date(year, month - 1, day);
  let contributionDate = new Date(year, month - 1, selectedDay);

  if (contributionDate < start) {
    contributionDate = new Date(year, month, selectedDay);
  }

  return formatDateInput(contributionDate);
}

function calculateMonthlyEquivalent(amount, frequency, contributionType) {
  if (contributionType !== "Recurring") return 0;
  const value = safeNumber(amount);

  switch (frequency) {
    case "Monthly": return value;
    case "Quarterly": return value / 3;
    case "Half Yearly": return value / 6;
    case "Yearly": return value / 12;
    default: return 0;
  }
}

function preventWheelChange(event) {
  event.currentTarget.blur();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function InvestmentForm({ onClose, onSuccess, editingInvestment = null }) {
  const finance = useFinance();
  const addInvestment = finance?.addInvestment;
  const updateInvestment = finance?.updateInvestment;
  const availableToAllocate = safeNumber(finance?.availableToAllocate);
  const isEdit = !!editingInvestment;

  const today = formatDateInput(new Date());

  const [investmentType, setInvestmentType] = useState(editingInvestment?.type || "SIP");
  const handleInvestmentTypeChange = (event) => {
    const val = event.target.value;
    setInvestmentType(val);
    if (!isEdit) {
      setMfFundName("");
      setMfUnits("");
      setGoldWeight("");
      setGoldPurity("24K / 999");
      setStockTicker("");
      setStockQuantity("");
      setStockPurchasePrice("");
    }
  };
  const [investmentName, setInvestmentName] = useState(editingInvestment?.name || "");
  const [amount, setAmount] = useState(
    editingInvestment?.amount !== undefined ? String(editingInvestment.amount) : ""
  );
  const [contributionAmount, setContributionAmount] = useState(
    editingInvestment?.monthlyContribution !== undefined
      ? String(editingInvestment.monthlyContribution)
      : editingInvestment?.amount !== undefined
      ? String(editingInvestment.amount)
      : ""
  );
  const [contributionType, setContributionType] = useState(editingInvestment?.contributionType || "Recurring");

  const [paymentSource, setPaymentSource] = useState(editingInvestment?.paymentSource || "Cash");
  const [bankName, setBankName] = useState(editingInvestment?.paymentSourceDetails?.bankName || "");
  const [accountLast4, setAccountLast4] = useState(editingInvestment?.paymentSourceDetails?.accountLast4 || "");
  const [upiId, setUpiId] = useState(editingInvestment?.paymentSourceDetails?.upiId || "");
  const [otherPaymentDetails, setOtherPaymentDetails] = useState(editingInvestment?.paymentSourceDetails?.otherDetails || "");
  const [contributionNote, setContributionNote] = useState(editingInvestment?.contributionNote || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [autoPayEnabled, setAutoPayEnabled] = useState(editingInvestment?.autoPay?.enabled || false);
  const [autoPayPaymentMethod, setAutoPayPaymentMethod] = useState(editingInvestment?.autoPay?.paymentMethod || "");
  const [autoPayBankName, setAutoPayBankName] = useState(editingInvestment?.autoPay?.bankName || "");
  const [autoPayAccountLast4, setAutoPayAccountLast4] = useState(editingInvestment?.autoPay?.accountLast4 || "");
  const [autoPayUpiApp, setAutoPayUpiApp] = useState(editingInvestment?.autoPay?.upiApp || "");
  const [autoPayUpiId, setAutoPayUpiId] = useState(editingInvestment?.autoPay?.upiId || "");

  const [investmentStatus, setInvestmentStatus] = useState(editingInvestment?.status || "Active");
  const [frequency, setFrequency] = useState(editingInvestment?.frequency || "Monthly");

  const [institution, setInstitution] = useState(editingInvestment?.institution || "");
  const [interestRate, setInterestRate] = useState(
    editingInvestment?.interestRate !== undefined ? String(editingInvestment.interestRate) : ""
  );
  const [interestMethod, setInterestMethod] = useState(editingInvestment?.interestMethod || "Payout");
  const [interestPayoutFrequency, setInterestPayoutFrequency] = useState(editingInvestment?.interestPayoutFrequency || "Quarterly");
  const [compoundingFrequency, setCompoundingFrequency] = useState(editingInvestment?.compoundingFrequency || "Quarterly");

  const [startDate, setStartDate] = useState(
    editingInvestment?.startDate ? formatDateInput(new Date(editingInvestment.startDate)) : today
  );
  const [contributionDay, setContributionDay] = useState(
    editingInvestment?.dueDay ? String(editingInvestment.dueDay) : "5"
  );
  const [maturityDate, setMaturityDate] = useState(
    editingInvestment?.maturityDate ? formatDateInput(new Date(editingInvestment.maturityDate)) : ""
  );

  const [reminderEnabled, setReminderEnabled] = useState(editingInvestment?.reminder?.enabled || false);
  const [fiveDaysBefore, setFiveDaysBefore] = useState(editingInvestment?.reminder?.notifyBefore?.includes(5) || false);
  const [oneDayBefore, setOneDayBefore] = useState(editingInvestment?.reminder?.notifyBefore?.includes(1) ?? true);
  const [onDueDate, setOnDueDate] = useState(editingInvestment?.reminder?.notifyBefore?.includes(0) ?? true);

  const [inAppReminder, setInAppReminder] = useState(editingInvestment?.reminder?.channels?.inApp ?? true);
  const [emailReminder, setEmailReminder] = useState(editingInvestment?.reminder?.channels?.email ?? true);

  const [maturityReminderEnabled, setMaturityReminderEnabled] = useState(editingInvestment?.maturityReminder?.enabled || false);
  const [twoMonthsBefore, setTwoMonthsBefore] = useState(editingInvestment?.maturityReminder?.notifyBeforeMonths?.includes(2) ?? true);
  const [oneMonthBefore, setOneMonthBefore] = useState(editingInvestment?.maturityReminder?.notifyBeforeMonths?.includes(1) ?? true);
  const [sevenDaysBeforeMaturity, setSevenDaysBeforeMaturity] = useState(editingInvestment?.maturityReminder?.notifyBeforeDays?.includes(7) ?? true);
  const [onMaturityDate, setOnMaturityDate] = useState(editingInvestment?.maturityReminder?.onMaturityDate ?? true);

  const [maturityInApp, setMaturityInApp] = useState(editingInvestment?.maturityReminder?.channels?.inApp ?? true);
  const [maturityEmail, setMaturityEmail] = useState(editingInvestment?.maturityReminder?.channels?.email ?? true);

  const [mfFundName, setMfFundName] = useState(
    editingInvestment?.schemeName || editingInvestment?.customDetails?.fundName || ""
  );
  const [mfUnits, setMfUnits] = useState(
    editingInvestment?.units !== undefined
      ? String(editingInvestment.units)
      : editingInvestment?.customDetails?.units !== undefined
      ? String(editingInvestment.customDetails.units)
      : ""
  );
  const [goldType, setGoldType] = useState(editingInvestment?.goldType || "Physical Gold");
  const [goldWeight, setGoldWeight] = useState(
    editingInvestment?.weight !== undefined
      ? String(editingInvestment.weight)
      : editingInvestment?.customDetails?.weight !== undefined
      ? String(editingInvestment.customDetails.weight)
      : ""
  );
  const [goldPurity, setGoldPurity] = useState(
    editingInvestment?.purity || editingInvestment?.customDetails?.purity || "24K / 999"
  );
  const [stockTicker, setStockTicker] = useState(
    editingInvestment?.symbol || editingInvestment?.customDetails?.ticker || ""
  );
  const [stockQuantity, setStockQuantity] = useState(
    editingInvestment?.quantity !== undefined
      ? String(editingInvestment.quantity)
      : editingInvestment?.customDetails?.quantity !== undefined
      ? String(editingInvestment.customDetails.quantity)
      : ""
  );
  const [stockPurchasePrice, setStockPurchasePrice] = useState(
    editingInvestment?.purchasePrice !== undefined
      ? String(editingInvestment.purchasePrice)
      : editingInvestment?.customDetails?.purchasePrice !== undefined
      ? String(editingInvestment.customDetails.purchasePrice)
      : ""
  );
  const [afterMaturityAction, setAfterMaturityAction] = useState(editingInvestment?.afterMaturityAction || "MANUAL_DECIDE");
  const [afterMaturityBankName, setAfterMaturityBankName] = useState(editingInvestment?.afterMaturityDetails?.bankName || "");
  const [afterMaturityAccountLast4, setAfterMaturityAccountLast4] = useState(editingInvestment?.afterMaturityDetails?.accountLast4 || "");
  const [afterMaturityNote, setAfterMaturityNote] = useState(editingInvestment?.afterMaturityDetails?.note || "");
  const [error, setError] = useState("");
  const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);
  const [pendingInvestmentData, setPendingInvestmentData] = useState(null);

  const isFixedDeposit = investmentType === "Fixed Deposit";
  const isRecurringDeposit = investmentType === "Recurring Deposit";
  const isSIP = investmentType === "SIP";
  const effectiveContributionType = isFixedDeposit ? "One Time" : (isRecurringDeposit ? "Recurring" : contributionType);
  const effectiveReminderEnabled =
    !isFixedDeposit && effectiveContributionType === "Recurring" && reminderEnabled;

  const amountNumber = safeNumber(amount);
  const contributionAmountNumber = safeNumber(contributionAmount);

  const monthlyContribution = useMemo(() => {
    if ((isFixedDeposit || isRecurringDeposit) || effectiveContributionType !== "Recurring") return 0;
    return calculateMonthlyEquivalent(contributionAmountNumber, frequency, effectiveContributionType);
  }, [contributionAmountNumber, amountNumber, frequency, effectiveContributionType, isFixedDeposit, isRecurringDeposit]);

  const nextContributionDate = useMemo(() => {
    if ((isFixedDeposit || isRecurringDeposit) || effectiveContributionType !== "Recurring") return null;
    return calculateNextContributionDate(startDate, contributionDay);
  }, [startDate, contributionDay, effectiveContributionType, isFixedDeposit, isRecurringDeposit]);

  const isAffordable =
    (isFixedDeposit || isRecurringDeposit) ||
    effectiveContributionType !== "Recurring" ||
    monthlyContribution <= availableToAllocate;

  const fdDetails = useMemo(
    () =>
      calculateFDDetails({
        principal: amountNumber,
        interestRate,
        interestMethod,
        payoutFrequency: interestPayoutFrequency,
        compoundingFrequency,
        startDate,
        maturityDate,
      }),
    [
      amountNumber,
      interestRate,
      interestMethod,
      interestPayoutFrequency,
      compoundingFrequency,
      startDate,
      maturityDate,
    ]
  );

  const rdDetails = useMemo(
    () =>
      calculateRDDetails({
        depositAmount: amountNumber,
        interestRate,
        startDate,
        maturityDate,
      }),
    [amountNumber, interestRate, startDate, maturityDate]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (typeof addInvestment !== "function") {
      setError("Investment service is not available.");
      setIsSubmitting(false);
      return;
    }

    if (!investmentName.trim()) {
      setError((isFixedDeposit || isRecurringDeposit) ? "Enter a name." : "Enter an investment name.");
      setIsSubmitting(false);
      return;
    }

    // For SIP, validate contributionAmount; for others, validate amount
    if (isSIP) {
      if (contributionAmountNumber <= 0) {
        setError("Enter a valid contribution amount for this SIP.");
        setIsSubmitting(false);
        return;
      }
    } else if (amountNumber <= 0) {
      setError(
        (isFixedDeposit || isRecurringDeposit)
          ? "Enter a valid principal amount."
          : "Enter a valid investment amount."
      );
      setIsSubmitting(false);
      return;
    }

    if (!startDate) {
      setError("Select the investment start date.");
      setIsSubmitting(false);
      return;
    }

    if (!paymentSource && !isFixedDeposit && !isRecurringDeposit) {
      setError("Select a payment source for this investment.");
      setIsSubmitting(false);
      return;
    }

    if (!autoPayEnabled) {
      if (paymentSource === "Bank Account" && !bankName.trim()) {
        setError("Enter the bank name.");
        setIsSubmitting(false);
        return;
      }

      if (paymentSource === "Bank Account" && accountLast4.length !== 4) {
        setError("Enter the last 4 digits of the bank account.");
        setIsSubmitting(false);
        return;
      }

      if (paymentSource === "UPI" && !upiId.trim()) {
        setError("Enter the UPI ID.");
        setIsSubmitting(false);
        return;
      }

      if (paymentSource === "Other" && !otherPaymentDetails.trim()) {
        setError("Enter the payment source details.");
        setIsSubmitting(false);
        return;
      }
    }

    if (
      isSIP &&
      effectiveContributionType === "Recurring" &&
      autoPayEnabled
    ) {
      if (!autoPayPaymentMethod) {
        setError("Select a payment method for SIP AutoPay.");
        setIsSubmitting(false);
        return;
      }

      if (autoPayPaymentMethod === "Bank Account") {
        if (!autoPayBankName.trim()) {
          setError("Enter the AutoPay bank name.");
          setIsSubmitting(false);
          return;
        }

        if (autoPayAccountLast4.length !== 4) {
          setError("Enter the last 4 digits of the AutoPay bank account.");
          setIsSubmitting(false);
          return;
        }
      }

      if (autoPayPaymentMethod === "UPI") {
        if (!autoPayUpiApp.trim()) {
          setError("Enter the UPI app used for SIP AutoPay.");
          setIsSubmitting(false);
          return;
        }

        if (!autoPayUpiId.trim()) {
          setError("Enter the AutoPay UPI ID.");
          setIsSubmitting(false);
          return;
        }
      }
    }

    if (isFixedDeposit || isRecurringDeposit) {
      if (!institution.trim()) {
        setError("Enter the bank or institution.");
        setIsSubmitting(false);
        return;
      }

      const numericRate = safeNumber(interestRate);
      if (numericRate <= 0 || numericRate > 100) {
        setError("Enter a valid annual interest rate.");
        setIsSubmitting(false);
        return;
      }

      if (!maturityDate) {
        setError("Select the maturity date.");
        setIsSubmitting(false);
        return;
      }

      if (maturityDate <= startDate) {
        setError("Maturity date must be after the start date.");
        setIsSubmitting(false);
        return;
      }
    }

    if (!isFixedDeposit && !isRecurringDeposit && effectiveContributionType === "Recurring") {
      const day = Number(contributionDay);

      if (!Number.isInteger(day) || day < 1 || day > 28) {
        setError("Contribution day must be between 1 and 28.");
        setIsSubmitting(false);
        return;
      }

      if (monthlyContribution > availableToAllocate) {
        setError(
          `This investment requires approximately ₹${formatMoney(
            monthlyContribution
          )} per month, but only ₹${formatMoney(
            availableToAllocate
          )} is currently available.`
        );
        setIsSubmitting(false);
        return;
      }
    }

    if (!isFixedDeposit && !isRecurringDeposit && maturityDate && maturityDate < startDate) {
      setError("Maturity date cannot be before the start date.");
      setIsSubmitting(false);
      return;
    }

    if (
      effectiveReminderEnabled &&
      !fiveDaysBefore &&
      !oneDayBefore &&
      !onDueDate
    ) {
      setError("Select at least one contribution reminder time.");
      setIsSubmitting(false);
      return;
    }

    if (
      effectiveReminderEnabled &&
      !inAppReminder &&
      !emailReminder
    ) {
      setError("Select at least one contribution reminder channel.");
      setIsSubmitting(false);
      return;
    }

    if (maturityReminderEnabled && !maturityDate) {
      setError("Select a maturity date to enable the maturity reminder.");
      setIsSubmitting(false);
      return;
    }

    if (
      maturityReminderEnabled &&
      !twoMonthsBefore &&
      !oneMonthBefore &&
      !sevenDaysBeforeMaturity &&
      !onMaturityDate
    ) {
      setError("Select at least one maturity reminder time.");
      setIsSubmitting(false);
      return;
    }

    if (
      maturityReminderEnabled &&
      !maturityInApp &&
      !maturityEmail
    ) {
      setError("Select at least one maturity reminder channel.");
      setIsSubmitting(false);
      return;
    }

    const notifyBefore = [];
    if (fiveDaysBefore) notifyBefore.push(5);
    if (oneDayBefore) notifyBefore.push(1);
    if (onDueDate) notifyBefore.push(0);

    const maturityNotifyBeforeMonths = [];
    if (twoMonthsBefore) maturityNotifyBeforeMonths.push(2);
    if (oneMonthBefore) maturityNotifyBeforeMonths.push(1);

    const maturityNotifyBeforeDays = [];
    if (sevenDaysBeforeMaturity) maturityNotifyBeforeDays.push(7);

    const investmentData = {
      name: investmentName.trim(),
      type: investmentType,
      amount: isSIP ? contributionAmountNumber : amountNumber,
      contributionType: effectiveContributionType,
      frequency: effectiveContributionType === "Recurring" ? frequency : null,
      // --------------------------------------------------------
      // RECURRING DUE DAY — stored on the investment document.
      // The backend uses this to automatically derive the full
      // due date for each month (e.g., dueDay=10 → 10 Mar 2026).
      // --------------------------------------------------------
      dueDay: effectiveContributionType === "Recurring" ? Number(contributionDay) : null,
      monthlyContribution: isFixedDeposit ? 0 : (isRecurringDeposit ? amountNumber : monthlyContribution),
      paymentSource: paymentSource || undefined,
      contributionNote: contributionNote.trim(),
      weight: investmentType === "Gold" ? safeNumber(goldWeight) : undefined,
      purity: investmentType === "Gold" ? goldPurity : undefined,
      goldType: investmentType === "Gold" ? goldType : undefined,
      schemeName: investmentType === "Mutual Fund" ? mfFundName.trim() : undefined,
      units: investmentType === "Mutual Fund" ? safeNumber(mfUnits) : undefined,
      symbol: investmentType === "Stocks" ? stockTicker.trim() : undefined,
      companyName: investmentType === "Stocks" ? investmentName.trim() : undefined,
      quantity: investmentType === "Stocks" ? safeNumber(stockQuantity) : undefined,
      purchasePrice: investmentType === "Stocks" ? safeNumber(stockPurchasePrice) : undefined,
      customDetails: (() => {
        const cd = {};
        if (investmentType === "Mutual Fund") {
          cd.fundName = mfFundName.trim();
          cd.units = safeNumber(mfUnits);
        } else if (investmentType === "Gold") {
          cd.weight = safeNumber(goldWeight);
          cd.purity = goldPurity;
        } else if (investmentType === "Stocks") {
          cd.ticker = stockTicker.trim();
          cd.quantity = safeNumber(stockQuantity);
          cd.purchasePrice = safeNumber(stockPurchasePrice);
        }
        return cd;
      })(),
      paymentSourceDetails: {
        bankName: paymentSource === "Bank Account" ? bankName.trim() : "",
        accountLast4: paymentSource === "Bank Account" ? accountLast4 : "",
        upiId: paymentSource === "UPI" ? upiId.trim() : "",
        otherDetails: paymentSource === "Other" ? otherPaymentDetails.trim() : "",
      },
      autoPay: {
        enabled:
          isSIP &&
          effectiveContributionType === "Recurring" &&
          autoPayEnabled,
        status:
          isSIP &&
          effectiveContributionType === "Recurring" &&
          autoPayEnabled
            ? "Active"
            : "Inactive",
        paymentMethod:
          isSIP &&
          effectiveContributionType === "Recurring" &&
          autoPayEnabled
            ? autoPayPaymentMethod
            : null,
        bankName:
          autoPayPaymentMethod === "Bank Account"
            ? autoPayBankName.trim()
            : "",
        accountLast4:
          autoPayPaymentMethod === "Bank Account"
            ? autoPayAccountLast4
            : "",
        upiApp:
          autoPayPaymentMethod === "UPI"
            ? autoPayUpiApp.trim()
            : "",
        upiId:
          autoPayPaymentMethod === "UPI"
            ? autoPayUpiId.trim()
            : "",
      },
      startDate,
      nextContributionDate: isFixedDeposit ? null : nextContributionDate,
      maturityDate: maturityDate || null,
      status: investmentStatus,
      ...((isFixedDeposit || isRecurringDeposit)
        ? {
            institution: institution.trim(),
            principalAmount: amountNumber,
            interestRate: safeNumber(interestRate),
            interestMethod: isFixedDeposit ? interestMethod : "Cumulative",
            interestPayoutFrequency:
              isFixedDeposit && interestMethod === "Payout" ? interestPayoutFrequency : null,
            compoundingFrequency:
              isFixedDeposit && interestMethod === "Cumulative" ? compoundingFrequency : null,
            estimatedInterest: isFixedDeposit
              ? fdDetails.estimatedInterest
              : rdDetails.estimatedInterest,
            estimatedAnnualInterest: isFixedDeposit ? fdDetails.estimatedAnnualInterest : 0,
            estimatedInterestPerPayout: isFixedDeposit ? fdDetails.estimatedInterestPerPayout : 0,
            estimatedMaturityAmount: isFixedDeposit
              ? fdDetails.estimatedMaturityAmount
              : rdDetails.estimatedMaturityAmount,
            totalInterestReceived: editingInvestment?.totalInterestReceived || 0,
            interestTransactions: editingInvestment?.interestTransactions || [],
            renewedFromId: null,
            renewedToId: null,
          }
        : {}),
      reminder: {
        enabled: effectiveReminderEnabled,
        contributionDay: effectiveReminderEnabled ? Number(contributionDay) : null,
        notifyBefore: effectiveReminderEnabled ? notifyBefore : [],
        channels: {
          inApp: effectiveReminderEnabled && inAppReminder,
          email: effectiveReminderEnabled && emailReminder,
        },
      },
      maturityReminder: {
        enabled: maturityReminderEnabled,
        notifyBeforeMonths: maturityReminderEnabled
          ? maturityNotifyBeforeMonths
          : [],
        notifyBeforeDays: maturityReminderEnabled ? maturityNotifyBeforeDays : [],
        onMaturityDate: maturityReminderEnabled ? onMaturityDate : false,
        channels: {
          inApp: maturityReminderEnabled && maturityInApp,
          email: maturityReminderEnabled && maturityEmail,
        },
      },
      afterMaturityAction: maturityDate ? afterMaturityAction : "MANUAL_DECIDE",
      afterMaturityDetails: maturityDate
        ? {
            bankName:
              afterMaturityAction === "BANK_SAVINGS"
                ? (afterMaturityBankName.trim() || institution.trim())
                : undefined,
            accountLast4:
              afterMaturityAction === "BANK_SAVINGS"
                ? afterMaturityAccountLast4.trim()
                : undefined,
            note: afterMaturityNote.trim() || undefined,
          }
        : {},
    };

    if (isEdit) {
      setIsSubmitting(false);
      setPendingInvestmentData(investmentData);
      setShowUpdateConfirmModal(true);
      return;
    }

    const result = await addInvestment(investmentData);
    if (result?.success === false) {
      if (result?.code === "INSUFFICIENT_FUNDS") {
        setIsSubmitting(false);
        if (typeof onClose === "function") onClose();
        return;
      }
      setError(result.message || "Unable to add the investment.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    if (typeof onSuccess === "function") {
      onSuccess({ isEdit: false, result });
    }

    if (typeof onClose === "function") {
      onClose();
    }
  }

  async function executeUpdate() {
    if (!pendingInvestmentData) return;
    setIsSubmitting(true);
    setShowUpdateConfirmModal(false);

    try {
      if (typeof updateInvestment !== "function") {
        setError("Update service is not available.");
        setIsSubmitting(false);
        return;
      }
      const result = await updateInvestment(editingInvestment.id || editingInvestment._id, pendingInvestmentData);
      if (result?.success === false) {
        setError(result.message || "Unable to update investment.");
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);

      if (typeof onSuccess === "function") {
        onSuccess({ isEdit: true, result });
      }

      if (typeof onClose === "function") {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to update investment.");
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && typeof onClose === "function") {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#e2e8dc] bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#edf0e9] bg-white px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6c8b72]">
              FinanceOS
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#18392c]">
              {isEdit ? "Edit Investment" : "Add Investment"}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              {isEdit ? "Modify investment details and configuration." : "Add investment details, contribution schedule, reminders and maturity information."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close investment form"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f4f7f1] hover:text-[#18392c]"
          >
            <FiX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto bg-[#fafcf8] p-6">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-red-600">{error}</p>
            </div>
          )}

          <section className="rounded-2xl border border-[#e2e8dc] bg-white p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf6e8] text-[#315c46]">
                <FiTrendingUp size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#18392c]">
                  Investment Details
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Enter the basic information for this investment.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[#52665b]">
                  Investment Type
                </span>
                <select
                  value={investmentType}
                  onChange={handleInvestmentTypeChange}
                  className={inputClass}
                >
                  <option value="SIP">SIP</option>
                  <option value="Mutual Fund">Mutual Fund</option>
                  <option value="Fixed Deposit">Fixed Deposit (FD)</option>
                  <option value="Recurring Deposit">Recurring Deposit (RD)</option>
                  <option value="Gold">Gold</option>
                  <option value="Stocks">Stocks</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#52665b]">
                  {(isFixedDeposit || isRecurringDeposit) ? "Name" : "Investment Name"}
                </span>
                <input
                  type="text"
                  value={investmentName}
                  onChange={(event) => {
                    setInvestmentName(event.target.value);
                    setError("");
                  }}
                  placeholder="Example: Retirement SIP"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#52665b]">
                  Investment Status
                </span>
                <select
                  value={investmentStatus}
                  onChange={(event) => {
                    setInvestmentStatus(event.target.value);
                    setError("");
                  }}
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                  <option value="Matured">Matured</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>

              {!isFixedDeposit && !isRecurringDeposit && (
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Contribution Note (optional)
                  </span>
                  <input
                    type="text"
                    value={contributionNote}
                    onChange={(e) => setContributionNote(e.target.value)}
                    placeholder="e.g., First SIP for retirement"
                    className={inputClass}
                  />
                </label>
              )}

              {!isFixedDeposit && !isRecurringDeposit && (
                <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6c8b72]">Additional Details</p>
                  {investmentType === "Mutual Fund" && (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Fund Name</span>
                        <input type="text" value={mfFundName} onChange={e=>{setMfFundName(e.target.value);setError("");}} placeholder="Example: ABC Growth Fund" className={inputClass}/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Units</span>
                        <MoneyInput value={mfUnits} onChange={setMfUnits} placeholder="100"/>
                      </label>
                    </div>
                  )}
                  {investmentType === "Gold" && (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Gold Type</span>
                        <select
                          value={goldType}
                          onChange={(e) => {
                            setGoldType(e.target.value);
                            setError("");
                          }}
                          className={inputClass}
                        >
                          <option value="Physical Gold">Physical Gold</option>
                          <option value="Digital Gold">Digital Gold</option>
                          <option value="Gold ETF">Gold ETF</option>
                          <option value="Sovereign Gold Bond">Sovereign Gold Bond</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Weight (grams) *</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={goldWeight}
                          onChange={(e) => {
                            setGoldWeight(e.target.value);
                            setError("");
                          }}
                          placeholder="e.g., 10"
                          className={inputClass}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Purity *</span>
                        <select
                          value={goldPurity}
                          onChange={(e) => {
                            setGoldPurity(e.target.value);
                            setError("");
                          }}
                          className={inputClass}
                        >
                          <option value="24K / 999">24K / 999 (99.9% Pure)</option>
                          <option value="22K / 916">22K / 916 (91.6% Pure)</option>
                          <option value="18K">18K (75.0% Pure)</option>
                          <option value="14K">14K (58.3% Pure)</option>
                          <option value="9K">9K (37.5% Pure)</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {investmentType === "Stocks" && (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Ticker Symbol</span>
                        <input type="text" value={stockTicker} onChange={e=>{setStockTicker(e.target.value);setError("");}} placeholder="e.g., AAPL" className={inputClass}/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Quantity</span>
                        <MoneyInput value={stockQuantity} onChange={setStockQuantity} placeholder="10"/>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">Purchase Price</span>
                        <MoneyInput value={stockPurchasePrice} onChange={setStockPurchasePrice} placeholder="1500"/>
                      </label>
                    </div>
                  )}
                </section>
              )}
            </div>

            {(isFixedDeposit || isRecurringDeposit) && (
              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Bank / Institution
                  </span>
                  <input
                    type="text"
                    value={institution}
                    onChange={(event) => {
                      setInstitution(event.target.value);
                      setError("");
                    }}
                    placeholder="Example: SBI"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    {isRecurringDeposit ? "Deposit Amount (per month)" : "Principal Amount"}
                  </span>
                  <MoneyInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="100000"
                  />
                </label>

                {/* Interest Rate — shown for both FD and RD */}
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Annual Interest Rate (%)
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={interestRate}
                      onChange={(event) => {
                        setInterestRate(event.target.value);
                        setError("");
                      }}
                      onWheel={preventWheelChange}
                      placeholder={isRecurringDeposit ? "6.5" : "7.25"}
                      className={`${inputClass} pr-10`}
                    />
                    <span className="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-sm text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    Enter the annual interest rate offered by your bank.
                  </p>
                </label>
              </div>
            )}

            {/* SIP: Contribution Amount — shown only for SIP */}
            {isSIP && (
              <div className="mt-5">
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Contribution Amount
                  </span>
                  <MoneyInput
                    value={contributionAmount}
                    onChange={setContributionAmount}
                    placeholder="5000"
                  />
                </label>
              </div>
            )}

            {/* Non-SIP, Non-FD/RD: Investment Amount (MF, Gold, Stocks, Other) */}
            {!isSIP && !isFixedDeposit && !isRecurringDeposit && (
              <div className="mt-5">
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Investment Amount
                  </span>
                  <MoneyInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="50000"
                  />
                </label>
              </div>
            )}
          </section>

          {isFixedDeposit && (
            <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6c8b72]">
                Fixed Deposit
              </p>
              <h3 className="mt-1 text-sm font-semibold text-[#18392c]">
                Interest Details
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-[#6c8b72]">
                Enter the FD interest terms provided by the bank.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[#52665b]">
                    Interest Method
                  </span>
                  <select
                    value={interestMethod}
                    onChange={(event) => {
                      setInterestMethod(event.target.value);
                      setError("");
                    }}
                    className={inputClass}
                  >
                    <option value="Payout">Interest Payout</option>
                    <option value="Cumulative">Cumulative / At Maturity</option>
                  </select>
                </label>

                {interestMethod === "Payout" && (
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-[#52665b]">
                      Interest Payout Frequency
                    </span>
                    <select
                      value={interestPayoutFrequency}
                      onChange={(event) =>
                        setInterestPayoutFrequency(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half Yearly">Half Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                    <p className="mt-2 text-[10px] leading-4 text-slate-400">
                      Interest credited by the bank will later be recorded as additional income for the month in which it is received.
                    </p>
                  </label>
                )}

                {interestMethod === "Cumulative" && (
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-[#52665b]">
                      Compounding Frequency
                    </span>
                    <select
                      value={compoundingFrequency}
                      onChange={(event) =>
                        setCompoundingFrequency(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half Yearly">Half Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </label>
                )}
              </div>
            </section>
          )}

          {/* ======================================================
              RD ESTIMATE
          ====================================================== */}
          {isRecurringDeposit && (
            <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf6e8] text-[#315c46]">
                  <FiDollarSign size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    RD Estimate
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-[#18392c]">
                    Expected Returns
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoBox
                  label="Total Deposits"
                  value={`₹${formatMoney(rdDetails.totalDeposits)}`}
                />
                <InfoBox
                  label="Estimated Interest"
                  value={`₹${formatMoney(rdDetails.estimatedInterest)}`}
                />
                <InfoBox
                  label="Estimated Maturity"
                  value={`₹${formatMoney(rdDetails.estimatedMaturityAmount)}`}
                />
              </div>

              {rdDetails.months > 0 && (
                <div className="mt-4 rounded-xl bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    Tenure
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#315c46]">
                    {rdDetails.months} month{rdDetails.months !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              <p className="mt-4 text-[10px] leading-5 text-slate-400">
                Calculation uses the standard RD formula (simple interest basis). Actual bank payout may vary slightly based on compounding method.
              </p>
            </section>
          )}


          {!isFixedDeposit && (
            <section className="rounded-2xl border border-[#e2e8dc] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#18392c]">
                Contribution Setup
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Choose whether this investment is recurring or one-time.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-[#52665b]">
                    Contribution Type
                  </span>
                  <select
                    value={contributionType}
                    onChange={(event) => {
                      setContributionType(event.target.value);
                      setError("");
                    }}
                    className={inputClass}
                  >
                    <option value="Recurring">Recurring</option>
                    <option value="One Time">One Time</option>
                  </select>
                </label>

                {effectiveContributionType === "Recurring" && (
                  <label className="block">
                    <span className="text-xs font-medium text-[#52665b]">
                      Contribution Frequency
                    </span>
                    <select
                      value={frequency}
                      onChange={(event) => setFrequency(event.target.value)}
                      className={inputClass}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half Yearly">Half Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </label>
                )}
              </div>

              {effectiveContributionType === "Recurring" && (
                <div
                  className={`mt-5 rounded-xl border p-4 ${
                    isAffordable
                      ? "border-[#dcebd4] bg-[#f7fbf4]"
                      : "border-red-100 bg-red-50"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    Monthly Commitment
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      isAffordable ? "text-[#315c46]" : "text-red-600"
                    }`}
                  >
                    ₹{formatMoney(monthlyContribution)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Available to allocate: ₹{formatMoney(availableToAllocate)}
                  </p>
                  {!isAffordable && (
                    <p className="mt-2 text-[10px] font-medium text-red-600">
                      This recurring investment is currently above your available monthly allocation.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-5 border-t border-[#edf0e9] pt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6c8b72]">
                  Payment Source
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Select the funding source used for this investment.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-[#52665b]">
                      Funding Method
                    </span>
                    <select
                      value={paymentSource}
                      onChange={(event) => {
                        setPaymentSource(event.target.value);
                        setError("");
                      }}
                      className={inputClass}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Account">Bank Account</option>
                      <option value="UPI">UPI</option>
                    </select>
                  </label>

                  {paymentSource === "Bank Account" && (
                    <>
                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">
                          Bank Name
                        </span>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => {
                            setBankName(e.target.value);
                            setError("");
                          }}
                          placeholder="Example: SBI"
                          className={inputClass}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-[#52665b]">
                          Last 4 Digits
                        </span>
                        <input
                          type="text"
                          maxLength={4}
                          value={accountLast4}
                          onChange={(e) => {
                            setAccountLast4(
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            );
                            setError("");
                          }}
                          placeholder="Example: 1234"
                          className={inputClass}
                        />
                      </label>
                    </>
                  )}

                  {paymentSource === "UPI" && (
                    <label className="block md:col-span-2">
                      <span className="text-xs font-medium text-[#52665b]">
                        UPI ID
                      </span>
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => {
                          setUpiId(e.target.value);
                          setError("");
                        }}
                        placeholder="Example: user@upi"
                        className={inputClass}
                      />
                    </label>
                  )}

                  {paymentSource === "Other" && (
                    <label className="block md:col-span-2">
                      <span className="text-xs font-medium text-[#52665b]">
                        Payment Details
                      </span>
                      <input
                        type="text"
                        value={otherPaymentDetails}
                        onChange={(e) => {
                          setOtherPaymentDetails(e.target.value);
                          setError("");
                        }}
                        placeholder="Enter payment source details"
                        className={inputClass}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* ==================================================
                  SIP AUTOPAY
              ================================================== */}

              {isSIP && effectiveContributionType === "Recurring" && (
                <div className="mt-5 border-t border-[#edf0e9] pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6c8b72]">
                        SIP AutoPay
                      </h4>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">
                        Automatically pay your recurring SIP contribution on the scheduled contribution date.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoPayEnabled((current) => !current);
                        setError("");
                      }}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                        autoPayEnabled ? "bg-[#315c46]" : "bg-slate-300"
                      }`}
                      aria-label="Toggle SIP AutoPay"
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                          autoPayEnabled ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {autoPayEnabled && (
                    <div className="mt-4 rounded-xl border border-[#dcebd4] bg-[#f7fbf4] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8f3df] text-[#315c46]">
                          <FiBell size={15} />
                        </div>
                        <div className="w-full">
                          <p className="text-xs font-semibold text-[#315c46]">
                            AutoPay Configuration
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[#6c8b72]">
                            Select the payment method to be used for automatic recurring SIP deductions.
                          </p>

                          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="block sm:col-span-2">
                              <span className="text-xs font-medium text-[#52665b]">
                                AutoPay Method
                              </span>
                              <select
                                value={autoPayPaymentMethod}
                                onChange={(event) => {
                                  setAutoPayPaymentMethod(event.target.value);
                                  setError("");
                                }}
                                className={inputClass}
                              >
                                <option value="">Select AutoPay Method</option>
                                <option value="Bank Account">Bank Account</option>
                                <option value="UPI">UPI</option>
                              </select>
                            </label>

                            {/* Bank Account */}
                            {autoPayPaymentMethod === "Bank Account" && (
                              <>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#52665b]">
                                    Bank Name
                                  </span>
                                  <input
                                    type="text"
                                    value={autoPayBankName}
                                    onChange={(event) => {
                                      setAutoPayBankName(event.target.value);
                                      setError("");
                                    }}
                                    placeholder="Example: SBI"
                                    className={inputClass}
                                  />
                                </label>

                                <label className="block">
                                  <span className="text-xs font-medium text-[#52665b]">
                                    Last 4 Digits
                                  </span>
                                  <input
                                    type="text"
                                    maxLength={4}
                                    value={autoPayAccountLast4}
                                    onChange={(event) => {
                                      setAutoPayAccountLast4(
                                        event.target.value.replace(/\D/g, "").slice(0, 4)
                                      );
                                      setError("");
                                    }}
                                    placeholder="Example: 4521"
                                    className={inputClass}
                                  />
                                </label>
                              </>
                            )}

                            {/* UPI */}
                            {autoPayPaymentMethod === "UPI" && (
                              <>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#52665b]">
                                    UPI App
                                  </span>
                                  <select
                                    value={autoPayUpiApp}
                                    onChange={(event) => {
                                      setAutoPayUpiApp(event.target.value);
                                      setError("");
                                    }}
                                    className={inputClass}
                                  >
                                    <option value="">Select UPI App</option>
                                    <option value="Google Pay">Google Pay</option>
                                    <option value="PhonePe">PhonePe</option>
                                    <option value="Paytm">Paytm</option>
                                    <option value="BHIM">BHIM</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </label>

                                <label className="block">
                                  <span className="text-xs font-medium text-[#52665b]">
                                    UPI ID
                                  </span>
                                  <input
                                    type="text"
                                    value={autoPayUpiId}
                                    onChange={(event) => {
                                      setAutoPayUpiId(event.target.value);
                                      setError("");
                                    }}
                                    placeholder="Example: user@okhdfcbank"
                                    className={inputClass}
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[#e2e8dc] bg-white p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f6ee] text-[#315c46]">
                <FiCalendar size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#18392c]">
                  Schedule
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Set the investment dates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-[#52665b]">
                  Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setError("");
                  }}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[#52665b]">
                  {isFixedDeposit ? "FD Maturity Date" : "Maturity Date"}
                </span>
                <input
                  type="date"
                  min={startDate || undefined}
                  value={maturityDate}
                  onChange={(event) => {
                    setMaturityDate(event.target.value);
                    setError("");
                  }}
                  className={inputClass}
                />
              </label>

              {!isFixedDeposit && effectiveContributionType === "Recurring" && (
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-[#52665b]">
                    Contribution Day
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={contributionDay}
                    onChange={(event) => {
                      setContributionDay(event.target.value);
                      setError("");
                    }}
                    onWheel={preventWheelChange}
                    className={inputClass}
                  />
                  <p className="mt-2 text-[10px] text-slate-400">
                    Use a day between 1 and 28 so it remains valid in every month.
                  </p>
                </label>
              )}
            </div>
          </section>

          {isFixedDeposit && (
            <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf6e8] text-[#315c46]">
                  <FiDollarSign size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    FD Estimate
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-[#18392c]">
                    Expected Returns
                  </h3>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Principal" value={`₹${formatMoney(amountNumber)}`} />
                <InfoBox label="Rate" value={`${safeNumber(interestRate)}% p.a.`} />
                <InfoBox
                  label="Estimated Interest"
                  value={`₹${formatMoney(fdDetails.estimatedInterest)}`}
                />
                <InfoBox
                  label={
                    interestMethod === "Cumulative"
                      ? "Expected Maturity"
                      : "Principal at Maturity"
                  }
                  value={`₹${formatMoney(fdDetails.estimatedMaturityAmount)}`}
                />
              </div>

              {interestMethod === "Payout" && (
                <div className="mt-4 rounded-xl bg-[#f7fbf4] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    Estimated {interestPayoutFrequency} Interest
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#315c46]">
                    ₹{formatMoney(fdDetails.estimatedInterestPerPayout)}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#6c8b72]">
                    This is only an estimate. It is not added to your monthly income until the interest is actually credited.
                  </p>
                </div>
              )}

              {interestMethod === "Cumulative" && (
                <div className="mt-4 rounded-xl bg-[#f7fbf4] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
                    Cumulative FD
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#52665b]">
                    Interest remains invested inside the FD and is included in the expected maturity amount.
                  </p>
                </div>
              )}

              <p className="mt-4 text-[10px] leading-5 text-slate-400">
                The calculation is an estimate. The bank's actual interest credit and maturity amount should be treated as the final values.
              </p>
            </section>
          )}

          {!isFixedDeposit && effectiveContributionType === "Recurring" && (
            <section className="rounded-2xl border border-[#e2e8dc] bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f6ee] text-[#315c46]">
                    <FiBell size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#18392c]">
                      Contribution Reminder
                    </h3>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Get reminded before the contribution date.
                    </p>
                  </div>
                </div>

                <Toggle
                  checked={reminderEnabled}
                  onChange={setReminderEnabled}
                />
              </div>

              {reminderEnabled && (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-medium text-[#52665b]">
                      Notify Me
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4">
                      <CheckOption
                        label="5 days before"
                        checked={fiveDaysBefore}
                        onChange={setFiveDaysBefore}
                      />
                      <CheckOption
                        label="1 day before"
                        checked={oneDayBefore}
                        onChange={setOneDayBefore}
                      />
                      <CheckOption
                        label="On due date"
                        checked={onDueDate}
                        onChange={setOnDueDate}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[#52665b]">
                      Notification Channel
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4">
                      <CheckOption
                        label="In-App"
                        checked={inAppReminder}
                        onChange={setInAppReminder}
                      />
                      <CheckOption
                        label="Email"
                        checked={emailReminder}
                        onChange={setEmailReminder}
                      />
                    </div>
                    <p className="mt-3 text-[10px] leading-4 text-slate-400">
                      In-App reminders appear in the FinanceOS notification bell. Email uses the user's registered contact information.
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[#e2e8dc] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2f6ee] text-[#315c46]">
                  <FiBell size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#18392c]">
                    {isFixedDeposit ? "FD Maturity Reminder" : "Maturity Reminder"}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Get notified before this investment matures.
                  </p>
                </div>
              </div>

              <Toggle
                checked={maturityReminderEnabled}
                onChange={setMaturityReminderEnabled}
              />
            </div>

            {maturityReminderEnabled && (
              <div className="mt-5 space-y-5">
                {!maturityDate && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-[10px] leading-4 text-amber-700">
                      Select a maturity date above to use this reminder.
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-[#52665b]">
                    Notify Me
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <CheckOption
                      label="2 months before"
                      checked={twoMonthsBefore}
                      onChange={setTwoMonthsBefore}
                    />
                    <CheckOption
                      label="1 month before"
                      checked={oneMonthBefore}
                      onChange={setOneMonthBefore}
                    />
                    <CheckOption
                      label="7 days before"
                      checked={sevenDaysBeforeMaturity}
                      onChange={setSevenDaysBeforeMaturity}
                    />
                    <CheckOption
                      label="On maturity date"
                      checked={onMaturityDate}
                      onChange={setOnMaturityDate}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-[#52665b]">
                    Notification Channel
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <CheckOption
                      label="In-App"
                      checked={maturityInApp}
                      onChange={setMaturityInApp}
                    />
                    <CheckOption
                      label="Email"
                      checked={maturityEmail}
                      onChange={setMaturityEmail}
                    />
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-400">
                    In-App maturity reminders appear in the FinanceOS notification bell.
                  </p>
                </div>
              </div>
            )}
          </section>

          {(isFixedDeposit || isRecurringDeposit || Boolean(maturityDate)) && (
            <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6c8b72]">
                    At / After Maturity
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-[#18392c]">
                    Choose what to do when this matures
                  </h3>
                </div>
                <span className="rounded-full bg-[#e2f0dc] px-2.5 py-1 text-[10px] font-bold text-[#2d523e]">
                  {afterMaturityAction === "RENEW_FULL"
                    ? "Auto-Renew"
                    : afterMaturityAction === "BANK_SAVINGS"
                    ? "Bank Transfer"
                    : afterMaturityAction === "KEEP_CASH"
                    ? "Keep as Cash"
                    : afterMaturityAction === "NEW_INVESTMENT"
                    ? "Reinvest"
                    : afterMaturityAction === "PAY_LIABILITY"
                    ? "Pay Liability"
                    : "Decide Later"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#52665b]">
                Select your preferred post-maturity action. When the maturity date arrives, FinanceOS will prompt or execute this option with full allocation tracking.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MaturityOptionButton
                  id="BANK_SAVINGS"
                  title="Transfer to Bank"
                  description="Move proceeds safely into your linked bank savings account."
                  icon={<FiCreditCard size={16} />}
                  isSelected={afterMaturityAction === "BANK_SAVINGS"}
                  onSelect={setAfterMaturityAction}
                />
                <MaturityOptionButton
                  id="RENEW_FULL"
                  title="Renew Investment"
                  description="Continue principal and returns into a renewed investment cycle."
                  icon={<FiRefreshCw size={16} />}
                  isSelected={afterMaturityAction === "RENEW_FULL"}
                  onSelect={setAfterMaturityAction}
                />
                <MaturityOptionButton
                  id="KEEP_CASH"
                  title="Keep as Cash"
                  description="Add maturity proceeds to Available to Allocate cash for flexible budgeting."
                  icon={<FiDollarSign size={16} />}
                  isSelected={afterMaturityAction === "KEEP_CASH"}
                  onSelect={setAfterMaturityAction}
                />
                <MaturityOptionButton
                  id="NEW_INVESTMENT"
                  title="Reinvest in New Scheme"
                  description="Deploy maturity funds into another mutual fund, FD, or asset."
                  icon={<FiBarChart2 size={16} />}
                  isSelected={afterMaturityAction === "NEW_INVESTMENT"}
                  onSelect={setAfterMaturityAction}
                />
                <MaturityOptionButton
                  id="PAY_LIABILITY"
                  title="Pay Down Liability"
                  description="Direct maturity proceeds toward loan paydowns or debt reduction."
                  icon={<FiCreditCard size={16} />}
                  isSelected={afterMaturityAction === "PAY_LIABILITY"}
                  onSelect={setAfterMaturityAction}
                />
                <MaturityOptionButton
                  id="MANUAL_DECIDE"
                  title="Decide at Maturity"
                  description="Keep allocation pending and choose the specific destination when matured."
                  icon={<FiTrendingUp size={16} />}
                  isSelected={afterMaturityAction === "MANUAL_DECIDE"}
                  onSelect={setAfterMaturityAction}
                />
              </div>

              {/* Extra Inputs based on Selection */}
              {afterMaturityAction === "BANK_SAVINGS" && (
                <div className="mt-4 rounded-xl border border-[#cfe0cc] bg-white p-4">
                  <p className="text-xs font-bold text-[#18392c]">Bank Account Details for Maturity Transfer</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold text-[#52665b]">Bank Name</label>
                      <input
                        type="text"
                        value={afterMaturityBankName}
                        onChange={(e) => setAfterMaturityBankName(e.target.value)}
                        placeholder={institution || "e.g., HDFC Bank, SBI"}
                        className={`${inputClass} !mt-1`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#52665b]">Account Last 4 Digits</label>
                      <input
                        type="text"
                        maxLength="4"
                        value={afterMaturityAccountLast4}
                        onChange={(e) => setAfterMaturityAccountLast4(e.target.value.replace(/\D/g, ""))}
                        placeholder="e.g., 4321"
                        className={`${inputClass} !mt-1`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {afterMaturityAction === "RENEW_FULL" && (
                <div className="mt-3 rounded-xl border border-[#bce0b5] bg-[#eef7ea] p-3 text-xs text-[#285038]">
                  <p className="font-semibold">Automatic Renewal Configured</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#446d54]">
                    When this matures, FinanceOS will generate a renewed investment continuing with the full principal & interest.
                  </p>
                </div>
              )}

              {afterMaturityAction === "KEEP_CASH" && (
                <div className="mt-3 rounded-xl border border-[#bce0b5] bg-[#eef7ea] p-3 text-xs text-[#285038]">
                  <p className="font-semibold">Cash Pool Credit Configured</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#446d54]">
                    Maturity proceeds will immediately increase your monthly Available to Allocate cash for flexible distribution.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[#dcebd4] bg-[#f7fbf4] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6c8b72]">
              Summary
            </p>

            {isFixedDeposit ? (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <SummaryItem label="Principal" value={`₹${formatMoney(amountNumber)}`} />
                <SummaryItem label="Interest Rate" value={`${safeNumber(interestRate)}%`} />
                <SummaryItem
                  label="Estimated Interest"
                  value={`₹${formatMoney(fdDetails.estimatedInterest)}`}
                />
                <SummaryItem
                  label={
                    interestMethod === "Cumulative"
                      ? "Expected Maturity"
                      : "Principal at Maturity"
                  }
                  value={`₹${formatMoney(fdDetails.estimatedMaturityAmount)}`}
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <SummaryItem
                  label={isSIP ? "Contribution" : "Amount"}
                  value={`₹${formatMoney(isSIP ? contributionAmountNumber : amountNumber)}`}
                />
                <SummaryItem label="Type" value={effectiveContributionType} />
                <SummaryItem
                  label="Monthly Equivalent"
                  value={`₹${formatMoney(monthlyContribution)}`}
                />
              </div>
            )}
          </section>

          <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col-reverse gap-3 border-t border-[#edf0e9] bg-white px-6 py-4 sm:flex-row sm:justify-end">
            {typeof onClose === "function" && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#dfe5da] bg-white px-5 py-3 text-xs font-semibold text-[#52665b] transition hover:bg-[#f7f9f4]"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#315c46] px-6 py-3 text-xs font-semibold text-white transition hover:bg-[#274c3a] disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : isEdit
                ? "Update Investment"
                : isFixedDeposit
                ? "Save Fixed Deposit"
                : "Save Investment"}
            </button>
          </div>
        </form>
      </div>
    </div>

    <CenteredModal
      isOpen={showUpdateConfirmModal}
      onClose={() => !isSubmitting && setShowUpdateConfirmModal(false)}
      title="Are you sure you want to update this plan?"
      message="Are you sure you want to update this plan?"
      type="confirm"
      iconType="info"
      confirmText={isSubmitting ? "Updating..." : "Update"}
      cancelText="Cancel"
      confirmVariant="primary"
      isProcessing={isSubmitting}
      onConfirm={executeUpdate}
    />
  </>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-sm text-slate-400">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onWheel={preventWheelChange}
        placeholder={placeholder}
        className={`${inputClass} pl-8`}
      />
    </div>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl bg-[#f8faf7] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6c8b72]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[#18392c]">{value}</p>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6c8b72]">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-semibold text-[#18392c]">{value}</p>
    </div>
  );
}

function MaturityOptionButton({ id, title, description, icon, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
        isSelected
          ? "border-[#315c46] bg-[#edf6e8] shadow-sm ring-2 ring-[#315c46]/20"
          : "border-[#dfe8dc] bg-white hover:border-[#9fbd8d] hover:bg-[#fafcf8]"
      }`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
              isSelected
                ? "bg-[#315c46] text-white"
                : "bg-[#edf6e8] text-[#315c46] group-hover:bg-[#e2f0dc]"
            }`}
          >
            {icon}
          </span>
          <p className="text-xs font-bold text-[#18392c]">{title}</p>
        </div>
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            isSelected
              ? "border-[#315c46] bg-[#315c46] text-white"
              : "border-[#cbdac8] bg-white group-hover:border-[#9fbd8d]"
          }`}
        >
          {isSelected && <FiCheck size={12} />}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[#52665b]">{description}</p>
    </button>
  );
}

function CheckOption({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-[#315c46]"
      />
      <span className="text-[11px] font-medium text-[#52665b]">{label}</span>
    </label>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-[#315c46]" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default InvestmentForm;