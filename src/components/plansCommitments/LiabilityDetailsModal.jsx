import { useState } from "react";
import {
  FiCreditCard,
  FiX,
  FiCalendar,
  FiBell,
  FiClock,
  FiDollarSign,
  FiCheckCircle,
  FiTrash2,
  FiEdit3,
  FiBookOpen,
  FiActivity,
  FiInfo,
  FiLock,
  FiArrowUpRight
} from "react-icons/fi";
import useFinance from "../../context/useFinance.js";
import { parseSelectedMonth } from "../../utils/monthLifecycle.js";
import { calculateDueDateForMonth, formatDateISO, formatDateDisplay } from "../../utils/dueDateSchedule.js";
import ReminderConfigModal from "../reminders/ReminderConfigModal.jsx";
import CenteredModal from "../common/CenteredModal.jsx";

const inputClass =
  "mt-2 w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-4 py-3 text-sm text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d] focus:bg-white";

function FieldLabel({ children }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8b72]">
      {children}
    </span>
  );
}

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateInput(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LiabilityDetailsModal({ liability, onClose, onEdit }) {
  const {
    selectedMonth,
    deleteLiability,
    recordLiabilityPayment,
    updateLiability
  } = useFinance();

  const monthBounds = parseSelectedMonth(selectedMonth);

  const [activeTab, setActiveTab] = useState("details"); // details, payments, actions
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Notes state
  const [liabilityNotes, setLiabilityNotes] = useState(liability?.notes || "");

  // Payment form states
  const [payAmount, setPayAmount] = useState(liability?.monthlyEMI || "");
  const [payType, setPayType] = useState("EMI"); // EMI, Prepayment

  // Stored due day from liability model
  const storedDueDay = liability?.dueDay
    || (liability?.nextDueDate ? new Date(liability.nextDueDate).getDate() : 5);
  const derivedDueDateISO = formatDateISO(
    calculateDueDateForMonth(storedDueDay, monthBounds.year, monthBounds.month)
  );

  const [payPaidDate, setPayPaidDate] = useState(monthBounds.defaultDate);
  const [payStatus, setPayStatus] = useState("Paid");
  const [payPrincipal, setPayPrincipal] = useState("");
  const [payInterest, setPayInterest] = useState("");
  const [payNote, setPayNote] = useState("");
  
  // Payment Source
  const [payMethod, setPayMethod] = useState(liability?.paymentSource?.method || "Cash");
  const [payBankName, setPayBankName] = useState(liability?.paymentSource?.bankName || "");
  const [payLast4, setPayLast4] = useState(liability?.paymentSource?.last4Digits || "");
  const [payUpiApp, setPayUpiApp] = useState(liability?.paymentSource?.upiApp || "");
  const [payUpiId, setPayUpiId] = useState(liability?.paymentSource?.upiId || "");
  const [payOther, setPayOther] = useState(liability?.paymentSource?.otherDetails || "");

  // Early Closure form states
  const [closureDate, setClosureDate] = useState(formatDateInput(new Date()));
  const [closureCharges, setClosureCharges] = useState("");
  const [closureNote, setClosureNote] = useState("");

  const handleUpdateNotes = async () => {
    setError("");
    setSuccess("");
    try {
      await updateLiability(liability._id || liability.id, { notes: liabilityNotes });
      setSuccess("Notes updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update notes.");
    }
  };

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

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!payAmount || Number(payAmount) <= 0) return setError("Enter a valid payment amount.");

    setActionModal({
      isOpen: true,
      title: "Confirm Payment",
      message: `Amount: ₹${formatMoney(payAmount)}\nPayment Source: ${payMethod}\n\nDo you want to record this payment?`,
      type: "confirm",
      confirmText: "Confirm",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const paymentSource = {
            method: payMethod,
            bankName: (payMethod === "Bank Account" || payMethod === "UPI") ? payBankName : "",
            last4Digits: payMethod === "Bank Account" ? payLast4 : "",
            upiApp: payMethod === "UPI" ? payUpiApp : "",
            upiId: payMethod === "UPI" ? payUpiId : "",
            otherDetails: payMethod === "Other" ? payOther : "",
          };

          await recordLiabilityPayment(liability._id || liability.id, {
            amount: Number(payAmount),
            paidDate: payPaidDate ? new Date(payPaidDate) : undefined,
            status: payStatus,
            type: payType,
            principalComponent: Number(payPrincipal) || 0,
            interestComponent: Number(payInterest) || 0,
            paymentSource,
            note: payNote,
            selectedMonth: monthBounds.iso,
          });

          setActionModal({
            isOpen: true,
            title: "Payment Recorded Successfully",
            message: `₹${formatMoney(payAmount)} has been recorded successfully.`,
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
          setPayNote("");
          setPayPrincipal("");
          setPayInterest("");
        } catch (err) {
          if (err?.code === "INSUFFICIENT_FUNDS") {
            setActionModal(prev => ({ ...prev, isOpen: false }));
            if (onClose) onClose();
            return;
          }
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Failed to record payment.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleEarlyClosure = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const penalty = Number(closureCharges) || 0;
    const outstanding = Number(liability?.remainingAmount || 0);
    const finalAmount = outstanding + penalty;

    setActionModal({
      isOpen: true,
      title: "Confirm Early Closure",
      message: `Confirm early closure of this liability? You will record a final closure payment of ₹${formatMoney(finalAmount)}.`,
      type: "confirm",
      confirmText: "Close Liability",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const paymentSource = {
            method: payMethod,
            bankName: (payMethod === "Bank Account" || payMethod === "UPI") ? payBankName : "",
            last4Digits: payMethod === "Bank Account" ? payLast4 : "",
            upiApp: payMethod === "UPI" ? payUpiApp : "",
            upiId: payMethod === "UPI" ? payUpiId : "",
            otherDetails: payMethod === "Other" ? payOther : "",
          };

          await recordLiabilityPayment(liability._id || liability.id, {
            amount: finalAmount,
            paidDate: closureDate ? new Date(closureDate) : undefined,
            status: "Paid",
            type: "Closure",
            principalComponent: outstanding,
            interestComponent: 0,
            paymentSource,
            note: closureNote || "Early Closure Payout",
            closureDetails: {
              closureDate: closureDate ? new Date(closureDate) : undefined,
              amountPaid: finalAmount,
              outstandingAtClosure: outstanding,
              penaltyCharges: penalty,
              note: closureNote || "Early Closure Payout"
            }
          });

          setActionModal({
            isOpen: true,
            title: "Liability Closed",
            message: "Liability closed early and status updated to Closed.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => {
              setActionModal(prev => ({ ...prev, isOpen: false }));
              setActiveTab("details");
            }
          });
        } catch (err) {
          if (err?.code === "INSUFFICIENT_FUNDS") {
            setActionModal(prev => ({ ...prev, isOpen: false }));
            if (onClose) onClose();
            return;
          }
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Failed to close liability.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleDelete = async () => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete?",
      message: "This action cannot be undone.",
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        setError("");
        try {
          await deleteLiability(liability._id || liability.id);
          setActionModal({
            isOpen: true,
            title: "Deleted Successfully",
            message: "The plan has been deleted successfully.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => {
              setActionModal(prev => ({ ...prev, isOpen: false }));
              onClose();
            },
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

  const original = Number(liability?.principalAmount || 0);
  const remaining = Number(liability?.remainingAmount || 0);
  const repaid = Math.max(original - remaining, 0);
  const repaidPct = original > 0 ? Math.min((repaid / original) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-[#e2e8dc] bg-white shadow-2xl overflow-hidden transition-all my-8">
        
        {/* Header section */}
        <div className="sticky top-0 z-10 border-b border-[#edf0e9] bg-[#fafcf8] p-6 flex items-start justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#315c46] text-white shadow-lg shadow-[#315c46]/10">
              <FiCreditCard size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6c8b72]">
                  {liability.type}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  liability.status === "Active" ? "bg-[#e2f0d9] text-[#385723]" :
                  liability.status === "Closed" ? "bg-slate-100 text-slate-600" :
                  liability.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                  "bg-amber-100 text-amber-800"
                }`}>
                  {liability.status}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-[#18392c]">{liability.name}</h2>
              <p className="text-xs text-slate-400 font-medium">Lender: {liability.lender || "Not specified"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#edf0e9] bg-[#fafcf8] px-6">
          {[
            { id: "details", label: "Details", icon: FiInfo },
            { id: "payments", label: "Payments & EMI", icon: FiDollarSign },
            { id: "actions", label: "Actions & Close", icon: FiActivity }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
                  isSelected
                    ? "border-[#315c46] text-[#315c46]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content body */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-600 font-semibold flex items-center gap-2">
              <FiInfo className="shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 font-semibold flex items-center gap-2">
              <FiCheckCircle className="shrink-0" />
              {success}
            </div>
          )}

          {/* TAB 1: DETAILS */}
          {activeTab === "details" && (
            <div className="space-y-6">
              
              {/* Amortization / Progress Meter */}
              {liability.type !== "Credit Card" && (
                <div className="rounded-2xl border border-[#e2e8dc] bg-[#fafcf8] p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400">Total Repayment Status</span>
                    <span className="font-bold text-[#315c46]">{repaidPct.toFixed(1)}% Repaid</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#e7eee2] overflow-hidden">
                    <div className="h-full bg-[#315c46] transition-all" style={{ width: `${repaidPct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 text-center pt-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Original</p>
                      <p className="text-sm font-extrabold text-[#18392c] mt-0.5">₹{formatMoney(original)}</p>
                    </div>
                    <div className="border-x border-[#edf0e9]">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Repaid Principal</p>
                      <p className="text-sm font-extrabold text-emerald-700 mt-0.5">₹{formatMoney(repaid)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Outstanding</p>
                      <p className="text-sm font-extrabold text-amber-700 mt-0.5">₹{formatMoney(remaining)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Credit Card Specific Progress */}
              {liability.type === "Credit Card" && (
                <div className="rounded-2xl border border-[#e2e8dc] bg-[#fafcf8] p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-400">Credit Limit Usage</span>
                    <span className="font-bold text-[#18392c]">{original > 0 ? ((remaining / original) * 100).toFixed(1) : 0}% Utilized</span>
                  </div>
                  <div className="h-3 rounded-full bg-[#e7eee2] overflow-hidden">
                    <div className="h-full bg-amber-600 transition-all" style={{ width: `${original > 0 ? (remaining / original) * 100 : 0}%` }} />
                  </div>
                  <div className="grid grid-cols-4 text-center pt-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Limit</p>
                      <p className="text-sm font-extrabold text-[#18392c] mt-0.5">₹{formatMoney(original)}</p>
                    </div>
                    <div className="border-l border-[#edf0e9]">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Outstanding</p>
                      <p className="text-sm font-extrabold text-amber-700 mt-0.5">₹{formatMoney(remaining)}</p>
                    </div>
                    <div className="border-l border-[#edf0e9]">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Due</p>
                      <p className="text-sm font-extrabold text-red-600 mt-0.5">₹{formatMoney(liability.creditCardDetails?.totalDue)}</p>
                    </div>
                    <div className="border-l border-[#edf0e9]">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Minimum Due</p>
                      <p className="text-sm font-extrabold text-slate-700 mt-0.5">₹{formatMoney(liability.creditCardDetails?.minimumDue)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Core fields grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <div>
                  <FieldLabel>Account Number / Ref</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c]">{liability.referenceNumber || "—"}</p>
                </div>
                <div>
                  <FieldLabel>Interest Rate</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c]">
                    {liability.interestRate ? `${liability.interestRate}% (${liability.interestType || "Fixed"})` : "0% / Not set"}
                  </p>
                </div>
                {liability.type !== "Credit Card" && (
                  <div>
                    <FieldLabel>Monthly EMI</FieldLabel>
                    <p className="text-sm font-bold text-[#18392c]">₹{formatMoney(liability.monthlyEMI)}</p>
                  </div>
                )}
                <div>
                  <FieldLabel>Payment Due Date</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c]">
                    {liability.nextDueDate ? formatDate(liability.nextDueDate) : "Not configured"}
                  </p>
                </div>
                <div>
                  <FieldLabel>Start Date</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c]">{formatDate(liability.startDate)}</p>
                </div>
                {liability.type !== "Credit Card" && (
                  <>
                    <div>
                      <FieldLabel>Tenure</FieldLabel>
                      <p className="text-sm font-bold text-[#18392c]">{liability.tenure ? `${liability.tenure} Months` : "—"}</p>
                    </div>
                    <div>
                      <FieldLabel>Maturity / End Date</FieldLabel>
                      <p className="text-sm font-bold text-[#18392c]">{formatDate(liability.endDate)}</p>
                    </div>
                  </>
                )}
                <div>
                  <FieldLabel>Payment Frequency</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c]">{liability.paymentFrequency || "Monthly"}</p>
                </div>
                <div>
                  <FieldLabel>Preferred Payment Source</FieldLabel>
                  <p className="text-sm font-bold text-[#18392c] flex items-center gap-1">
                    {liability.paymentSource?.method || "Cash"}
                    {liability.paymentSource?.method === "Bank Account" && (
                      <span className="text-slate-400 font-normal text-xs">
                        ({liability.paymentSource.bankName} xx{liability.paymentSource.last4Digits})
                      </span>
                    )}
                    {liability.paymentSource?.method === "UPI" && (
                      <span className="text-slate-400 font-normal text-xs">
                        ({liability.paymentSource.upiApp})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Type-Specific fields */}
              {liability.type === "Home Loan" && liability.homeDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Collateral Property Details</h4>
                  <p className="text-slate-600 font-medium">Property type: <span className="font-bold text-[#18392c]">{liability.homeDetails.propertyType}</span></p>
                  <p className="text-slate-600 font-medium">Property address: <span className="font-bold text-[#18392c]">{liability.homeDetails.propertyAddress || "Not entered"}</span></p>
                  <p className="text-slate-600 font-medium">Down payment: <span className="font-bold text-[#18392c]">₹{formatMoney(liability.homeDetails.downPayment)}</span></p>
                </div>
              )}

              {liability.type === "Vehicle Loan" && liability.vehicleDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Pledged Vehicle details</h4>
                  <p className="text-slate-600 font-medium">Vehicle type: <span className="font-bold text-[#18392c]">{liability.vehicleDetails.vehicleType}</span></p>
                  <p className="text-slate-600 font-medium">Make / model: <span className="font-bold text-[#18392c]">{liability.vehicleDetails.make} {liability.vehicleDetails.model} {liability.vehicleDetails.variant}</span></p>
                  <p className="text-slate-600 font-medium">Reg no: <span className="font-bold text-[#18392c]">{liability.vehicleDetails.registrationNumber || "Not entered"}</span></p>
                </div>
              )}

              {liability.type === "Education Loan" && liability.educationDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Educational Arrangements</h4>
                  <p className="text-slate-600 font-medium">Course: <span className="font-bold text-[#18392c]">{liability.educationDetails.courseName}</span></p>
                  <p className="text-slate-600 font-medium">Institution: <span className="font-bold text-[#18392c]">{liability.educationDetails.educationalInstitution}</span></p>
                  <p className="text-slate-600 font-medium">Moratorium Period: <span className="font-bold text-[#18392c]">{liability.educationDetails.moratoriumPeriod} Months</span></p>
                  <p className="text-slate-600 font-medium">Repayment starts: <span className="font-bold text-[#18392c]">{formatDate(liability.educationDetails.repaymentStartDate)}</span></p>
                </div>
              )}

              {liability.type === "Credit Card" && liability.creditCardDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Credit Card Billing details</h4>
                  <p className="text-slate-600 font-medium">Statement Date: <span className="font-bold text-[#18392c]">{formatDate(liability.creditCardDetails.statementDate)}</span></p>
                </div>
              )}

              {liability.type === "Gold Loan" && liability.goldDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Pledged Gold Collateral</h4>
                  <p className="text-slate-600 font-medium">Gold description: <span className="font-bold text-[#18392c]">{liability.goldDetails.goldDescription || "—"}</span></p>
                  <p className="text-slate-600 font-medium">Gold weight: <span className="font-bold text-[#18392c]">{liability.goldDetails.pledgedGoldWeight} Grams</span></p>
                </div>
              )}

              {liability.type === "Business Loan" && liability.businessDetails && (
                <div className="rounded-xl bg-[#fafcf8] p-4 border border-[#e2e8dc] text-xs space-y-2">
                  <h4 className="font-bold text-[#18392c] uppercase tracking-wider text-[10px] text-[#6c8b72]">Business Entity details</h4>
                  <p className="text-slate-600 font-medium">Business: <span className="font-bold text-[#18392c]">{liability.businessDetails.businessName}</span></p>
                </div>
              )}

              {/* Reminders section */}
              <div className="rounded-xl border border-[#edf0e9] bg-[#fafcf8] p-4 text-xs flex justify-between items-center">
                <div>
                  <p className="font-bold text-[#18392c]">Due Reminders Status</p>
                  <p className="text-slate-400 mt-0.5">
                    {liability.reminder?.enabled 
                      ? `Notifying ${liability.reminder.notifyBefore ? liability.reminder.notifyBefore.join(", ") : liability.reminder.daysBefore} days before via ${Object.keys(liability.reminder.channels || {}).filter(k => liability.reminder.channels[k]).join(", ")}`
                      : "Reminders are disabled"
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReminderModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#c3d9b8] bg-[#edf5e8] px-3 py-1.5 font-semibold text-[#244c3b] hover:bg-[#dfeecd] transition cursor-pointer"
                >
                  <FiBell className="text-xs" />
                  {liability.reminder?.enabled ? "Manage Reminder" : "Set Reminder"}
                </button>
              </div>

              {/* Notes management */}
              <div className="space-y-2 border-t border-[#edf0e9] pt-4">
                <FieldLabel>Policy Notes & Comments</FieldLabel>
                <textarea
                  value={liabilityNotes}
                  onChange={(e) => setLiabilityNotes(e.target.value)}
                  placeholder="Record bank transaction reference IDs, collateral updates, etc..."
                  className={`${inputClass} h-20 resize-none`}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleUpdateNotes}
                    className="rounded-lg bg-[#315c46] px-4 py-2 text-xs font-bold text-white hover:bg-[#18392c] transition"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAYMENTS */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              
              {/* Add payment form */}
              {remaining > 0 && (
                <form onSubmit={handleAddPayment} className="rounded-2xl border border-[#e2e8dc] bg-[#fafcf8] p-5 space-y-4">
                  <SectionHeading title="Record Payment / EMI Payout" description="Save payment transaction details to update outstanding debt amounts." />
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel>Payment Type</FieldLabel>
                      <select value={payType} onChange={(e) => setPayType(e.target.value)} className={inputClass}>
                        <option value="EMI">Monthly EMI Payment</option>
                        <option value="Prepayment">Prepayment / Extra Principal</option>
                      </select>
                    </div>

                    <div>
                      <FieldLabel>Amount Paid</FieldLabel>
                      <input
                        type="number"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <FieldLabel>Transaction Status</FieldLabel>
                      <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className={inputClass}>
                        <option value="Paid">Fully Paid</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Not Paid">Not Paid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>
                  </div>

                  {payType === "EMI" && liability.type !== "Credit Card" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Principal Component (Optional)</FieldLabel>
                        <input
                          type="number"
                          value={payPrincipal}
                          onChange={(e) => setPayPrincipal(e.target.value)}
                          placeholder="e.g. 1800"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Interest Component (Optional)</FieldLabel>
                        <input
                          type="number"
                          value={payInterest}
                          onChange={(e) => setPayInterest(e.target.value)}
                          placeholder="e.g. 700"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <FieldLabel>
                        <span className="inline-flex items-center gap-1">
                          <FiLock size={10} className="text-amber-500" />
                          Due Date (Auto)
                        </span>
                      </FieldLabel>
                      <input
                        type="text"
                        readOnly
                        value={formatDateDisplay(derivedDueDateISO)}
                        title={`Automatically derived from EMI due day ${storedDueDay} for ${monthBounds.formatted}`}
                        className={`${inputClass} bg-[#f9fbf6] cursor-not-allowed`}
                      />
                      <p className="mt-1 text-[10px] text-[#8fa895]">
                        Day {storedDueDay} of {monthBounds.formatted}
                      </p>
                    </div>

                    <div>
                      <FieldLabel>Paid Date</FieldLabel>
                      <input
                        type="date"
                        min={monthBounds.minDate}
                        max={monthBounds.maxDate}
                        value={payPaidDate}
                        onChange={(e) => setPayPaidDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <FieldLabel>Payment Source Method</FieldLabel>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputClass}>
                        <option value="Cash">Cash</option>
                        <option value="Bank Account">Bank Account</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Source specific subfields */}
                  {payMethod === "Bank Account" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Bank Name</FieldLabel>
                        <input
                          type="text"
                          value={payBankName}
                          onChange={(e) => setPayBankName(e.target.value)}
                          placeholder="e.g. Axis Bank"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>Last 4 Digits</FieldLabel>
                        <input
                          type="text"
                          maxLength={4}
                          value={payLast4}
                          onChange={(e) => setPayLast4(e.target.value)}
                          placeholder="e.g. 1234"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {payMethod === "UPI" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>UPI App</FieldLabel>
                        <input
                          type="text"
                          value={payUpiApp}
                          onChange={(e) => setPayUpiApp(e.target.value)}
                          placeholder="e.g. Paytm / GPay"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel>UPI ID</FieldLabel>
                        <input
                          type="text"
                          value={payUpiId}
                          onChange={(e) => setPayUpiId(e.target.value)}
                          placeholder="e.g. name@okaxis"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {payMethod === "Other" && (
                    <div>
                      <FieldLabel>Other Details</FieldLabel>
                      <input
                        type="text"
                        value={payOther}
                        onChange={(e) => setPayOther(e.target.value)}
                        placeholder="e.g. Cheque payment details"
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div>
                    <FieldLabel>Payment Note</FieldLabel>
                    <input
                      type="text"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      placeholder="e.g. Paid through HDFC Salary Account."
                      className={inputClass}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-[#315c46] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#18392c] transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Recording..." : "Record Payment"}
                    </button>
                  </div>
                </form>
              )}

              {/* Payment history list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#18392c] uppercase tracking-wider text-[#6c8b72]">Payment History</h4>
                {(!liability.payments || liability.payments.length === 0) ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                    No payment transactions recorded for this liability.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {liability.payments.map((tx, idx) => (
                      <div key={tx._id || idx} className="rounded-xl border border-[#edf0e9] bg-[#fafcf8] p-4 flex justify-between items-center text-xs shadow-sm hover:shadow-md transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              tx.type === "Prepayment" ? "bg-purple-100 text-purple-700" :
                              tx.type === "Closure" ? "bg-red-100 text-red-700" :
                              "bg-[#e2f0d9] text-[#385723]"
                            }`}>
                              {tx.type}
                            </span>
                            <span className="font-bold text-[#18392c]">₹{formatMoney(tx.amount)}</span>
                            <span className="text-slate-400">• {formatDate(tx.date || tx.paidDate)}</span>
                          </div>
                          {tx.note && <p className="text-slate-500 mt-1 italic">"{tx.note}"</p>}
                          {tx.paymentSource && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Paid via {tx.paymentSource.method} 
                              {tx.paymentSource.method === "Bank Account" && ` (${tx.paymentSource.bankName} xx${tx.paymentSource.last4Digits})`}
                              {tx.paymentSource.method === "UPI" && ` (${tx.paymentSource.upiApp})`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            tx.status === "Paid" ? "bg-emerald-100 text-emerald-800" :
                            tx.status === "Partially Paid" ? "bg-amber-100 text-amber-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: ACTIONS */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              
              {/* Early Closure */}
              {remaining > 0 && (
                <form onSubmit={handleEarlyClosure} className="rounded-2xl border border-red-100 bg-red-50/50 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <FiArrowUpRight size={18} />
                    <h3 className="text-sm font-bold">Close Liability Early</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-red-700">
                    Settle this loan or liability before the full tenure. This will record a closing payment matching the outstanding principal balance (₹{formatMoney(remaining)}) plus any early closure penalties.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Early Closure Date</FieldLabel>
                      <input
                        type="date"
                        value={closureDate}
                        onChange={(e) => setClosureDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <FieldLabel>Penalty / Charges (if any)</FieldLabel>
                      <input
                        type="number"
                        value={closureCharges}
                        onChange={(e) => setClosureCharges(e.target.value)}
                        placeholder="e.g. 500"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Closure Note</FieldLabel>
                    <input
                      type="text"
                      value={closureNote}
                      onChange={(e) => setClosureNote(e.target.value)}
                      placeholder="e.g. Settled with savings bonus."
                      className={inputClass}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-red-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-red-800 transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Processing..." : "Settle & Close"}
                    </button>
                  </div>
                </form>
              )}

              {/* General actions */}
              <div className="rounded-2xl border border-[#e2e8dc] bg-[#fafcf8] p-5 space-y-4">
                <SectionHeading title="System Actions" description="Edit or permanently remove this record from your database." />
                
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-2 rounded-xl border border-[#dfe6da] bg-white px-5 py-3 text-xs font-bold text-[#18392c] hover:bg-[#f4f7f1] transition"
                  >
                    <FiEdit3 />
                    Edit Details
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-2 rounded-xl bg-red-50 px-5 py-3 text-xs font-bold text-red-600 hover:bg-red-100 transition"
                  >
                    <FiTrash2 />
                    Delete Liability
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-[#edf0e9] bg-[#fafcf8] p-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#315c46] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#18392c] transition"
          >
            Close Viewer
          </button>
        </div>

      </div>

      {/* REMINDER MODAL */}
      {showReminderModal && (
        <ReminderConfigModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          sourceType="Liability"
          sourceId={liability._id || liability.id}
          itemName={liability.name || liability.title || liability.lender || "Liability"}
          amount={Number(liability.monthlyEMI || liability.monthlyPayment || liability.remainingAmount || 0)}
          dueDate={derivedDueDateISO}
          initialData={liability}
        />
      )}

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
