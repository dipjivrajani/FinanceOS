import { useState } from "react";
import {
  FiX,
  FiCalendar,
  FiActivity,
  FiCreditCard,
  FiUser,
  FiPlus,
  FiTrash2,
  FiEdit,
  FiShield,
  FiRotateCw,
  FiDollarSign,
  FiFileText,
  FiAlertCircle,
  FiCpu,
  FiList,
  FiBell,
  FiLock,
} from "react-icons/fi";
import useFinance from "../../context/useFinance.js";
import { parseSelectedMonth } from "../../utils/monthLifecycle.js";
import { calculateDueDateForMonth, formatDateISO, formatDateDisplay } from "../../utils/dueDateSchedule.js";
import ReminderConfigModal from "../reminders/ReminderConfigModal.jsx";
import CenteredModal from "../common/CenteredModal.jsx";

const inputClass =
  "mt-2 w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-4 py-3 text-sm text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d]";

function FieldLabel({ children }) {
  return <label className="mb-2 block text-xs font-semibold text-[#52665b]">{children}</label>;
}

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
    </div>
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

export default function InsuranceDetailsModal({ policy, onClose, onEdit }) {
  const {
    selectedMonth,
    deleteInsurancePolicy,
    addInsurancePayment,
    renewInsurance,
    recordInsuranceMaturity,
    updateInsurancePolicy
  } = useFinance();

  const monthBounds = parseSelectedMonth(selectedMonth);

  const [activeTab, setActiveTab] = useState("details"); // details, payments, actions
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

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

  // Policy notes state
  const [policyNotes, setPolicyNotes] = useState(policy?.notes || "");

  // Payment form states
  const [payAmount, setPayAmount] = useState(policy?.premiumAmount || "");

  // Derive due date from policy.premiumDueDay + selected month
  const storedDueDay = policy?.premiumDueDay
    || (policy?.startDate ? new Date(policy.startDate).getDate() : 1);
  const derivedDueDateISO = formatDateISO(
    calculateDueDateForMonth(storedDueDay, monthBounds.year, monthBounds.month)
  );

  const [payPaidDate, setPayPaidDate] = useState(monthBounds.defaultDate);
  const [payStatus, setPayStatus] = useState("Paid");
  const [payMethod, setPayMethod] = useState(policy?.paymentSource?.method || "Cash");
  const [payBankName, setPayBankName] = useState(policy?.paymentSource?.bankName || "");
  const [payLast4, setPayLast4] = useState(policy?.paymentSource?.last4Digits || "");
  const [payUpiApp, setPayUpiApp] = useState(policy?.paymentSource?.upiApp || "");
  const [payUpiId, setPayUpiId] = useState(policy?.paymentSource?.upiId || "");
  const [payOther, setPayOther] = useState(policy?.paymentSource?.otherDetails || "");
  const [payNote, setPayNote] = useState("");

  // Renewal form states
  const [renewStartDate, setRenewStartDate] = useState(formatDateInput(new Date()));
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewPremium, setRenewPremium] = useState(policy?.premiumAmount || "");
  const [renewFrequency, setRenewFrequency] = useState(policy?.premiumFrequency || "Yearly");
  const [renewPolicyNumber, setRenewPolicyNumber] = useState("");
  const [renewNotes, setRenewNotes] = useState("");

  // Maturity form states
  const [actualMaturityAmount, setActualMaturityAmount] = useState(policy?.maturityDetails?.expectedMaturityAmount || "");
  const [actualMaturityDate, setActualMaturityDate] = useState(formatDateInput(new Date()));
  const [maturityReceivedDestination, setMaturityReceivedDestination] = useState("Bank Account");
  const [maturityPayoutAction, setMaturityPayoutAction] = useState("Keep in Bank Account");
  const [maturityNote, setMaturityNote] = useState("");

  // Covered item states (Home)
  const [newItemName, setNewItemName] = useState("");
  const [newItemBrand, setNewItemBrand] = useState("");
  const [newItemModel, setNewItemModel] = useState("");
  const [newItemPurchaseDate, setNewItemPurchaseDate] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemCoverage, setNewItemCoverage] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);

  const handleUpdateNotes = async () => {
    setError("");
    setSuccess("");
    try {
      await updateInsurancePolicy(policy._id, { notes: policyNotes });
      setSuccess("Notes updated successfully.");
    } catch (err) {
      setError(err.message || "Failed to update notes.");
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!payAmount || Number(payAmount) <= 0) return setError("Enter a valid payment amount.");

    setActionModal({
      isOpen: true,
      title: "Confirm Premium Payment",
      message: `Amount: ₹${formatMoney(payAmount)}\nPayment Source: ${payMethod}\n\nDo you want to record this premium payment?`,
      type: "confirm",
      confirmText: "Confirm",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const paymentSource = {
            method: payMethod,
            bankName: payMethod === "Bank Account" || payMethod === "UPI" ? payBankName : "",
            last4Digits: payMethod === "Bank Account" ? payLast4 : "",
            upiApp: payMethod === "UPI" ? payUpiApp : "",
            upiId: payMethod === "UPI" ? payUpiId : "",
            otherDetails: payMethod === "Other" ? payOther : "",
          };

          await addInsurancePayment(policy._id, {
            amount: Number(payAmount),
            paidDate: payStatus === "Paid" ? payPaidDate : undefined,
            status: payStatus,
            paymentSource,
            note: payNote,
            selectedMonth: monthBounds.iso,
          });

          setActionModal({
            isOpen: true,
            title: "Premium Payment Recorded",
            message: `₹${formatMoney(payAmount)} has been added successfully.`,
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
          setPayNote("");
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

  const handleRenew = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!renewPremium || Number(renewPremium) <= 0) return setError("Enter a valid premium amount.");
    if (!renewStartDate) return setError("Select renewal start date.");

    setIsSubmitting(true);
    try {
      await renewInsurance(policy._id, {
        startDate: renewStartDate,
        endDate: renewEndDate || undefined,
        premiumAmount: Number(renewPremium),
        premiumFrequency: renewFrequency,
        policyNumber: renewPolicyNumber,
        notes: renewNotes,
        paymentSource: policy.paymentSource
      });
      setSuccess("Policy renewed successfully.");
      setActiveTab("details");
    } catch (err) {
      setError(err.message || "Failed to renew policy.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaturity = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!actualMaturityAmount || Number(actualMaturityAmount) <= 0) return setError("Enter actual maturity amount.");

    setIsSubmitting(true);
    try {
      await recordInsuranceMaturity(policy._id, {
        actualMaturityAmount: Number(actualMaturityAmount),
        actualMaturityDate: actualMaturityDate,
        receivedDestination: maturityReceivedDestination,
        payoutAction: maturityPayoutAction,
        note: maturityNote
      });
      setSuccess("Maturity payouts recorded successfully.");
      setActiveTab("details");
    } catch (err) {
      setError(err.message || "Failed to record maturity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddHomeItem = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!newItemName.trim()) return setError("Item name is required.");

    try {
      const currentItems = policy.homeDetails?.electronicsItems || [];
      const newElectronics = [
        ...currentItems,
        {
          itemName: newItemName,
          brand: newItemBrand,
          model: newItemModel,
          purchaseDate: newItemPurchaseDate || null,
          approxValue: Number(newItemValue) || 0,
          coverageValue: Number(newItemCoverage) || 0,
          note: newItemNote
        }
      ];

      await updateInsurancePolicy(policy._id, {
        homeDetails: {
          ...policy.homeDetails,
          electronicsItems: newElectronics
        }
      });

      setSuccess("Electronic item added to policy coverage.");
      setNewItemName("");
      setNewItemBrand("");
      setNewItemModel("");
      setNewItemPurchaseDate("");
      setNewItemValue("");
      setNewItemCoverage("");
      setNewItemNote("");
      setShowItemForm(false);
    } catch (err) {
      setError(err.message || "Failed to add covered item.");
    }
  };

  const handleDeleteHomeItem = (indexToDelete) => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete?",
      message: "Remove this covered item from policy?",
      type: "confirm",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        setError("");
        setSuccess("");
        try {
          const currentItems = policy.homeDetails?.electronicsItems || [];
          const newElectronics = currentItems.filter((_, idx) => idx !== indexToDelete);

          await updateInsurancePolicy(policy._id, {
            homeDetails: {
              ...policy.homeDetails,
              electronicsItems: newElectronics
            }
          });
          setActionModal({
            isOpen: true,
            title: "Deleted Successfully",
            message: "Covered item deleted.",
            type: "success",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (err) {
          setActionModal({
            isOpen: true,
            title: "Something went wrong",
            message: err.message || "Failed to delete item.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      }
    });
  };

  const handleDeletePolicy = () => {
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
          await deleteInsurancePolicy(policy._id);
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
            message: err.message || "Failed to delete policy.",
            type: "error",
            confirmText: "OK",
            onConfirm: () => setActionModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // Calculations
  const totalPremiumPaid = policy.payments
    ? policy.payments
        .filter((p) => p.status === "Paid")
        .reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;

  const formattedPaymentSource = (src) => {
    if (!src || !src.method) return "Cash";
    if (src.method === "UPI") return `UPI: ${src.upiApp || "App"} (${src.upiId || "ID"})`;
    if (src.method === "Bank Account") return `Bank: ${src.bankName || "Bank"} (x-${src.last4Digits || "0000"})`;
    return src.method + (src.otherDetails ? ` (${src.otherDetails})` : "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#edf0e9] bg-[#fafcf8] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f0e4] text-[#315c46]">
              <FiShield size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#18392c]">{policy.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {policy.type}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  policy.status === "Active" ? "bg-green-100 text-green-700" :
                  policy.status === "Expired" ? "bg-red-100 text-red-700" :
                  policy.status === "Matured" ? "bg-blue-100 text-blue-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {policy.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex border-b border-slate-100 bg-[#fafcf8] px-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-1.5 py-3 border-b-2 px-3 transition ${
              activeTab === "details" ? "border-[#315c46] text-[#315c46]" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <FiFileText size={14} /> Overview & Notes
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex items-center gap-1.5 py-3 border-b-2 px-3 transition ${
              activeTab === "payments" ? "border-[#315c46] text-[#315c46]" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <FiCreditCard size={14} /> Premium History ({policy.payments?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`flex items-center gap-1.5 py-3 border-b-2 px-3 transition ${
              activeTab === "actions" ? "border-[#315c46] text-[#315c46]" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <FiRotateCw size={14} /> Maturity / Renewal
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 flex items-center gap-2">
              <FiAlertCircle className="shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-600 flex items-center gap-2">
              <FiActivity className="shrink-0" /> {success}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "details" && (
            <div className="space-y-6">
              
              {/* PRIMARY DETAILS */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 sm:grid-cols-3 text-xs">
                <div>
                  <p className="text-slate-400">Provider</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{policy.provider || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">Policy Number</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{policy.policyNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">Premium Frequency</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{policy.premiumFrequency || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">Premium Amount</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">₹{formatMoney(policy.premiumAmount)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Monthly Equivalent</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">₹{formatMoney(policy.monthlyPremium)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Source</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{formattedPaymentSource(policy.paymentSource)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Start Date</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{formatDate(policy.startDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Expiry / End Date</p>
                  <p className="font-semibold text-[#18392c] mt-0.5">{formatDate(policy.endDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Total Premium Paid</p>
                  <p className="font-bold text-[#315c46] mt-0.5">₹{formatMoney(totalPremiumPaid)}</p>
                </div>
              </div>

              {/* DYNAMIC METADATA INFORMATION DISPLAY */}
              {policy.type === "Life Insurance" && (
                <div className="border border-blue-100 bg-blue-50/20 p-4 rounded-xl space-y-3 text-xs">
                  <h3 className="font-bold text-blue-900 flex items-center gap-1.5"><FiUser /> Life Insurance (LIC) Details</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <p className="text-slate-600">Nominee: <span className="font-semibold text-slate-800">{policy.nominee || "—"}</span></p>
                    <p className="text-slate-600">Sum Assured: <span className="font-semibold text-slate-800">₹{formatMoney(policy.maturityDetails?.sumAssured)}</span></p>
                    {policy.maturityDetails?.hasMaturity && (
                      <>
                        <p className="text-slate-600">Expected Maturity Date: <span className="font-semibold text-slate-800">{formatDate(policy.maturityDate)}</span></p>
                        <p className="text-slate-600">Expected Return: <span className="font-semibold text-slate-800">₹{formatMoney(policy.maturityDetails?.expectedMaturityAmount)}</span></p>
                      </>
                    )}
                  </div>
                  {policy.status === "Matured" && (
                    <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-1 gap-2 sm:grid-cols-2 bg-blue-100/30 p-2.5 rounded-lg text-blue-900">
                      <p className="font-bold">Matured Details:</p>
                      <p>Actual Amount Received: <span className="font-bold">₹{formatMoney(policy.maturityDetails?.actualMaturityAmount)}</span></p>
                      <p>Actual Payout Date: <span className="font-semibold">{formatDate(policy.maturityDetails?.actualMaturityDate)}</span></p>
                      <p>Difference (Profit/Loss): <span className="font-bold">{policy.maturityDetails?.difference >= 0 ? "+" : ""}{formatMoney(policy.maturityDetails?.difference)}</span></p>
                      <p>Destination: <span className="font-semibold">{policy.maturityDetails?.receivedDestination}</span></p>
                      <p>Allocation Action: <span className="font-semibold">{policy.maturityDetails?.payoutAction}</span></p>
                      {policy.maturityDetails?.note && <p className="col-span-2">Note: {policy.maturityDetails?.note}</p>}
                    </div>
                  )}
                </div>
              )}

              {policy.type === "Health Insurance" && (
                <div className="border border-green-100 bg-green-50/20 p-4 rounded-xl space-y-3 text-xs">
                  <h3 className="font-bold text-green-900 flex items-center gap-1.5"><FiActivity /> Health Insurance Details</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <p className="text-slate-600">Sum Insured: <span className="font-semibold text-slate-800">₹{formatMoney(policy.coverageAmount)}</span></p>
                    <p className="text-slate-600">Insured Members: <span className="font-semibold text-slate-800">{policy.healthDetails?.insuredMembers?.join(", ") || "—"}</span></p>
                    <p className="text-slate-600">Waiting Period: <span className="font-semibold text-slate-800">{policy.healthDetails?.waitingPeriod || 0} months</span></p>
                    <p className="text-slate-600">Covered Conditions: <span className="font-semibold text-slate-800">{policy.healthDetails?.coverageCategory?.join(", ") || "Hospitalization"}</span></p>
                    <p className="text-slate-600">Hospital Networks: <span className="font-semibold text-slate-800">
                      {[
                        policy.healthDetails?.hospitalCoverage?.government && "Government",
                        policy.healthDetails?.hospitalCoverage?.private && "Private",
                        policy.healthDetails?.hospitalCoverage?.network && "Network"
                      ].filter(Boolean).join(", ") || "None Specified"}
                    </span></p>
                    <p className="text-slate-600">Payment Source Method: <span className="font-semibold text-slate-800">{policy.paymentSource?.method || "—"}</span></p>
                    <div className="col-span-2 flex gap-4 mt-2">
                      <span className={`px-2 py-0.5 rounded border ${policy.healthDetails?.hospitalCoverage?.cashless ? "bg-green-100/50 text-green-700 border-green-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                        Cashless
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${policy.healthDetails?.hospitalCoverage?.reimbursement ? "bg-green-100/50 text-green-700 border-green-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                        Reimbursement
                      </span>
                    </div>
                    {policy.healthDetails?.hospitalCoverage?.details && (
                      <p className="col-span-2 text-slate-500 italic mt-1 bg-slate-100/50 p-2 rounded">
                        Network Details: {policy.healthDetails.hospitalCoverage.details}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {policy.type === "Vehicle Insurance" && (
                <div className="border border-amber-100 bg-amber-50/20 p-4 rounded-xl space-y-3 text-xs">
                  <h3 className="font-bold text-amber-900 flex items-center gap-1.5"><FiCreditCard /> Vehicle Insurance Details</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <p className="text-slate-600">Vehicle Type: <span className="font-semibold text-slate-800">{policy.vehicleDetails?.vehicleType || "—"}</span></p>
                    <p className="text-slate-600">Reg Number: <span className="font-semibold text-slate-800">{policy.vehicleDetails?.registrationNumber || "—"}</span></p>
                    <p className="text-slate-600">Make & Model: <span className="font-semibold text-slate-800">{policy.vehicleDetails?.make} {policy.vehicleDetails?.model}</span></p>
                    <p className="text-slate-600">Variant: <span className="font-semibold text-slate-800">{policy.vehicleDetails?.variant || "—"}</span></p>
                    <p className="text-slate-600">Insured Declared Value (IDV): <span className="font-semibold text-slate-800">₹{formatMoney(policy.vehicleDetails?.idv)}</span></p>
                    <p className="text-slate-600">Coverage Type: <span className="font-semibold text-slate-800">{policy.vehicleDetails?.coverageType || "Comprehensive"}</span></p>
                    <p className="text-slate-600">Purchase Date: <span className="font-semibold text-slate-800">{formatDate(policy.vehicleDetails?.purchaseDate)}</span></p>
                    {policy.vehicleDetails?.addons && policy.vehicleDetails.addons.length > 0 && (
                      <p className="col-span-2 text-slate-600">Add-ons: <span className="font-medium text-slate-800">{policy.vehicleDetails.addons.join(", ")}</span></p>
                    )}
                  </div>
                </div>
              )}

              {policy.type === "Home Insurance" && (
                <div className="border border-purple-100 bg-purple-50/20 p-4 rounded-xl space-y-3 text-xs">
                  <h3 className="font-bold text-purple-900 flex items-center gap-1.5"><FiShield /> Home / Asset Insurance Details</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <p className="text-slate-600">Property Type: <span className="font-semibold text-slate-800">{policy.homeDetails?.propertyType || "—"}</span></p>
                    <p className="text-slate-600">Property Address: <span className="font-semibold text-slate-800">{policy.homeDetails?.propertyAddress || "—"}</span></p>
                    <p className="text-slate-600">Insured Valuation: <span className="font-semibold text-slate-800">₹{formatMoney(policy.homeDetails?.insuredPropertyValue)}</span></p>
                    <p className="text-slate-600">Covered Scope: <span className="font-semibold text-slate-800">{policy.homeDetails?.coveredItems?.join(", ") || "—"}</span></p>
                  </div>

                  {/* Electronics Coverage List */}
                  <div className="border-t border-purple-100 pt-3 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-purple-800 flex items-center gap-1"><FiCpu /> Protected Electronics / Items ({policy.homeDetails?.electronicsItems?.length || 0})</h4>
                      <button
                        onClick={() => setShowItemForm(!showItemForm)}
                        type="button"
                        className="text-[10px] text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded flex items-center gap-0.5"
                      >
                        <FiPlus /> Add Item
                      </button>
                    </div>

                    {showItemForm && (
                      <form onSubmit={handleAddHomeItem} className="bg-purple-100/20 p-3 rounded-lg border border-purple-200/50 space-y-3 mb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Item Name *" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="p-1.5 text-xs rounded border outline-none" required />
                          <input type="text" placeholder="Brand" value={newItemBrand} onChange={(e) => setNewItemBrand(e.target.value)} className="p-1.5 text-xs rounded border outline-none" />
                          <input type="text" placeholder="Model" value={newItemModel} onChange={(e) => setNewItemModel(e.target.value)} className="p-1.5 text-xs rounded border outline-none" />
                          <input type="date" placeholder="Purchase Date" value={newItemPurchaseDate} onChange={(e) => setNewItemPurchaseDate(e.target.value)} className="p-1.5 text-xs rounded border outline-none" />
                          <input type="number" placeholder="Approx Value" value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} className="p-1.5 text-xs rounded border outline-none" />
                          <input type="number" placeholder="Coverage Value" value={newItemCoverage} onChange={(e) => setNewItemCoverage(e.target.value)} className="p-1.5 text-xs rounded border outline-none" />
                        </div>
                        <input type="text" placeholder="Notes" value={newItemNote} onChange={(e) => setNewItemNote(e.target.value)} className="w-full p-1.5 text-xs rounded border outline-none" />
                        <div className="flex justify-end gap-2 text-[10px]">
                          <button type="button" onClick={() => setShowItemForm(false)} className="px-2 py-1 bg-slate-100 rounded text-slate-500">Cancel</button>
                          <button type="submit" className="px-2 py-1 bg-purple-700 rounded text-white font-semibold">Save Item</button>
                        </div>
                      </form>
                    )}

                    {policy.homeDetails?.electronicsItems && policy.homeDetails.electronicsItems.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {policy.homeDetails.electronicsItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start bg-slate-50 p-2 rounded border border-slate-100">
                            <div>
                              <p className="font-bold text-slate-800">{item.itemName} <span className="font-normal text-slate-400">({item.brand || "Generic"})</span></p>
                              <p className="text-[10px] text-slate-500">Value: ₹{formatMoney(item.approxValue)} | Coverage: ₹{formatMoney(item.coverageValue)}</p>
                              {item.note && <p className="text-[9px] text-slate-400 italic mt-0.5">Note: {item.note}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteHomeItem(idx)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete Item"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No specific electronics listed under home coverage.</p>
                    )}
                  </div>
                </div>
              )}

              {/* REMINDERS DETAILS */}
              <div className="border border-slate-150 bg-slate-100/10 p-4 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 flex items-center gap-1.5"><FiBell /> Notification & Reminders</h3>
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#c3d9b8] bg-[#edf5e8] px-2.5 py-1 text-[11px] font-semibold text-[#244c3b] hover:bg-[#dfeecd] transition cursor-pointer"
                  >
                    <FiBell className="text-xs" />
                    {policy.reminder?.enabled ? "Manage Reminder" : "Enable Reminder"}
                  </button>
                </div>
                {policy.reminder?.enabled ? (
                  <div className="space-y-1">
                    <p className="text-slate-600">Reminder status: <span className="font-semibold text-green-600">Enabled</span></p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="font-medium text-slate-500 border-b pb-0.5 mb-1">Premium Alarms</p>
                        <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                          {policy.reminder.premiumReminders?.fiveDaysBefore && <li>5 days before due date</li>}
                          {policy.reminder.premiumReminders?.oneDayBefore && <li>1 day before due date</li>}
                          {policy.reminder.premiumReminders?.onDueDate && <li>On due date</li>}
                          {Array.isArray(policy.reminder.notifyBefore) && policy.reminder.notifyBefore.length > 0 && (
                            <li>Alert offsets: {policy.reminder.notifyBefore.join(", ")} days before</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-slate-500 border-b pb-0.5 mb-1">Expiry Alarms</p>
                        <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                          {policy.reminder.expiryReminders?.twoMonthsBefore && <li>2 months before expiry</li>}
                          {policy.reminder.expiryReminders?.oneMonthBefore && <li>1 month before expiry</li>}
                          {policy.reminder.expiryReminders?.sevenDaysBefore && <li>7 days before expiry</li>}
                          {policy.reminder.expiryReminders?.onExpiryDate && <li>On expiry date</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Reminders are disabled for this policy.</p>
                )}
              </div>

              {/* NOTES REMARKS SECTION */}
              <div className="space-y-2">
                <FieldLabel>Policy Level Remarks</FieldLabel>
                <div className="flex gap-2">
                  <textarea
                    value={policyNotes}
                    onChange={(e) => setPolicyNotes(e.target.value)}
                    placeholder="Update policy-level note..."
                    className="flex-1 rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-3 py-2 text-xs text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d] h-20 resize-none"
                  />
                  <button
                    onClick={handleUpdateNotes}
                    className="px-4 py-2 bg-[#18392c] hover:bg-[#244c3b] rounded-xl text-white text-xs font-semibold self-end transition"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PREMIUM PAYMENTS */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              
              {/* ADD PAYMENT FORM */}
              <form onSubmit={handleAddPayment} className="bg-[#fafcf8] p-4 rounded-xl border border-[#dfe6da] space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#315c46] flex items-center gap-1"><FiPlus /> Record Premium Payment</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Premium Amount *</FieldLabel>
                    <MoneyInput value={payAmount} onChange={setPayAmount} placeholder="Amount" />
                  </div>
                  <div>
                    <FieldLabel>Status</FieldLabel>
                    <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)} className={inputClass}>
                      <option value="Paid">Paid</option>
                      <option value="Not Paid">Not Paid</option>
                      <option value="Skipped">Skipped</option>
                    </select>
                  </div>
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
                      title={`Automatically derived from premium due day ${storedDueDay} for ${monthBounds.formatted}`}
                      className={`${inputClass} bg-[#f9fbf6] cursor-not-allowed`}
                    />
                    <p className="mt-1 text-[10px] text-[#8fa895]">
                      Day {storedDueDay} of {monthBounds.formatted}
                    </p>
                  </div>
                  {payStatus === "Paid" && (
                    <div>
                      <FieldLabel>Paid Date</FieldLabel>
                      <input type="date" min={monthBounds.minDate} max={monthBounds.maxDate} value={payPaidDate} onChange={(e) => setPayPaidDate(e.target.value)} className={inputClass} />
                    </div>
                  )}
                  <div>
                    <FieldLabel>Payment Source Method</FieldLabel>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputClass}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Account">Bank Account</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Subpayment Source options */}
                {payMethod === "UPI" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs border-t pt-2">
                    <input type="text" placeholder="UPI App (e.g. PhonePe)" value={payUpiApp} onChange={(e) => setPayUpiApp(e.target.value)} className="p-2 border rounded" />
                    <input type="text" placeholder="UPI ID (e.g. name@upi)" value={payUpiId} onChange={(e) => setPayUpiId(e.target.value)} className="p-2 border rounded" />
                  </div>
                )}

                {payMethod === "Bank Account" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs border-t pt-2">
                    <input type="text" placeholder="Bank Name (e.g. HDFC)" value={payBankName} onChange={(e) => setPayBankName(e.target.value)} className="p-2 border rounded" />
                    <input type="text" placeholder="Last 4 account digits (e.g. 1234)" maxLength={4} value={payLast4} onChange={(e) => setPayLast4(e.target.value.replace(/\D/g, ""))} className="p-2 border rounded" />
                  </div>
                )}

                <div>
                  <FieldLabel>Payment Note</FieldLabel>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. Paid from savings balance"
                    className={inputClass}
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-[#18392c] hover:bg-[#244c3b] rounded-xl text-white text-xs font-semibold transition"
                  >
                    {isSubmitting ? "Recording..." : "Record Payment"}
                  </button>
                </div>
              </form>

              {/* PAYMENT HISTORY LIST */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1"><FiList /> Premium History</h3>
                {policy.payments && policy.payments.length > 0 ? (
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                          <th className="p-3">Due Date</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Paid Date</th>
                          <th className="p-3">Method</th>
                          <th className="p-3">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {policy.payments.map((pmt, idx) => (
                          <tr key={pmt._id || idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3">{formatDate(pmt.dueDate)}</td>
                            <td className="p-3 font-semibold text-[#18392c]">₹{formatMoney(pmt.amount)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                pmt.status === "Paid" ? "bg-green-100 text-green-700" :
                                pmt.status === "Skipped" ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {pmt.status}
                              </span>
                            </td>
                            <td className="p-3">{pmt.status === "Paid" ? formatDate(pmt.paidDate || pmt.date) : "—"}</td>
                            <td className="p-3 text-slate-500">{formattedPaymentSource(pmt.paymentSource)}</td>
                            <td className="p-3 text-slate-400 italic">{pmt.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center border">
                    No premium payment history found for this policy.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RENEWAL & MATURITY */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              {/* MATURITY PANEL (LIC/Life with maturity only) */}
              {policy.type === "Life Insurance" && (
                <form onSubmit={handleMaturity} className="bg-blue-50/20 border border-blue-100 p-4 rounded-xl space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5"><FiDollarSign /> Record Maturity Survival Benefit</h3>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Use this form to close the policy and claim your maturity amount. Expected maturity returns for this policy is <strong>₹{formatMoney(policy.maturityDetails?.expectedMaturityAmount)}</strong>.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <FieldLabel>Actual Received Amount *</FieldLabel>
                      <MoneyInput value={actualMaturityAmount} onChange={setActualMaturityAmount} placeholder="Amount" />
                    </div>
                    <div>
                      <FieldLabel>Actual Maturity Payout Date</FieldLabel>
                      <input type="date" value={actualMaturityDate} onChange={(e) => setActualMaturityDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <FieldLabel>Where was it received?</FieldLabel>
                      <select value={maturityReceivedDestination} onChange={(e) => setMaturityReceivedDestination(e.target.value)} className={inputClass}>
                        <option value="Bank Account">Bank Account</option>
                        <option value="Cash">Cash</option>
                        <option value="Other">Other Balance</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel>What do you want to do with this amount?</FieldLabel>
                      <select value={maturityPayoutAction} onChange={(e) => setMaturityPayoutAction(e.target.value)} className={inputClass}>
                        <option value="Keep in Bank Account">Keep in Bank Account</option>
                        <option value="Keep as Cash">Keep as Cash</option>
                        <option value="Reinvest">Reinvest</option>
                        <option value="Allocate to Saving Goal">Allocate to Saving Goal</option>
                        <option value="Pay/close Liability">Pay/close Liability</option>
                        <option value="Create Investment">Create Investment</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Maturity Note</FieldLabel>
                    <input type="text" placeholder="e.g. Matured, deposited to HDFC" value={maturityNote} onChange={(e) => setMaturityNote(e.target.value)} className={inputClass} />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-xl text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Recording..." : "Record Maturity Payout"}
                    </button>
                  </div>
                </form>
              )}

              {/* RENEWAL PANEL (Vehicle/Home/Other/Health) */}
              {policy.type !== "Life Insurance" && (
                <form onSubmit={handleRenew} className="bg-amber-50/20 border border-amber-100 p-4 rounded-xl space-y-4">
                  <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5"><FiRotateCw /> Renew Policy</h3>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Renewing this policy will archive the current policy structure into history and spawn a new active policy with updated dates. Old policy history will remain fully intact.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <FieldLabel>New Start Date *</FieldLabel>
                      <input type="date" value={renewStartDate} onChange={(e) => setRenewStartDate(e.target.value)} className={inputClass} required />
                    </div>
                    <div>
                      <FieldLabel>New End / Expiry Date</FieldLabel>
                      <input type="date" value={renewEndDate} onChange={(e) => setRenewEndDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <FieldLabel>New Premium Amount</FieldLabel>
                      <MoneyInput value={renewPremium} onChange={setRenewPremium} placeholder="New Amount" />
                    </div>
                    <div>
                      <FieldLabel>New Policy Number (if changed)</FieldLabel>
                      <input type="text" placeholder="e.g. new policy code" value={renewPolicyNumber} onChange={(e) => setRenewPolicyNumber(e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  <div className="text-xs">
                    <FieldLabel>New Premium Frequency</FieldLabel>
                    <select value={renewFrequency} onChange={(e) => setRenewFrequency(e.target.value)} className={inputClass}>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                      <option value="One Time">One Time</option>
                    </select>
                  </div>

                  <div>
                    <FieldLabel>Renewal Notes</FieldLabel>
                    <input type="text" placeholder="e.g. Renewed for another year" value={renewNotes} onChange={(e) => setRenewNotes(e.target.value)} className={inputClass} />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 rounded-xl text-white text-xs font-semibold transition disabled:opacity-50"
                    >
                      {isSubmitting ? "Renewing..." : "Renew Policy"}
                    </button>
                  </div>
                </form>
              )}

              {/* RENEWAL HISTORY AUDIT LOG */}
              {policy.renewedFromId && (
                <div className="bg-slate-50 border p-3 rounded-xl text-xs text-slate-500">
                  <p className="flex items-center gap-1"><FiAlertCircle /> This policy is a renewal. It was converted from an older policy record in the database.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-[#edf0e9] bg-[#fafcf8] px-6 py-4 flex justify-between items-center">
          <button
            onClick={handleDeletePolicy}
            className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition"
          >
            <FiTrash2 /> Delete Policy
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1 rounded-xl border border-[#dfe6da] px-4 py-2.5 text-xs font-semibold text-[#324f40] transition hover:bg-[#f4f7f1]"
            >
              <FiEdit /> Edit Details
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-[#18392c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#244c3b]"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* REMINDER MODAL */}
      {showReminderModal && (
        <ReminderConfigModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          sourceType="Insurance"
          sourceId={policy._id || policy.id}
          itemName={policy.policyName || policy.name || "Insurance Policy"}
          amount={Number(policy.premiumAmount || policy.monthlyPremium || 0)}
          dueDate={derivedDueDateISO}
          initialData={policy}
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
