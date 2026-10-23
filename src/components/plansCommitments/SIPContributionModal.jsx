import { useState, useMemo } from "react";
import { FiX, FiDollarSign, FiCalendar, FiCheckCircle, FiLock, FiCreditCard } from "react-icons/fi";
import useFinance from "../../context/useFinance.js";
import { parseSelectedMonth } from "../../utils/monthLifecycle.js";
import CenteredModal from "../common/CenteredModal.jsx";

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return safeNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate the due date for the selected month using the investment's
 * stored dueDay. Clamps to the last valid day of the month.
 *
 * @param {number} dueDay  - Day of month (1-31) from investment
 * @param {number} year    - Selected year
 * @param {number} month   - Selected month (1-12)
 * @returns {string}       - ISO date string YYYY-MM-DD
 */
function deriveDueDateISO(dueDay, year, month) {
  const day = Math.max(1, Math.min(dueDay || 10, new Date(year, month, 0).getDate()));
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  const d = new Date(`${isoStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SIPContributionModal({ investment, onClose }) {
  const { addSIPContribution, selectedMonth } = useFinance();
  const monthBounds = parseSelectedMonth(selectedMonth);

  // ============================================================
  // DERIVE DUE DATE AUTOMATICALLY (READ-ONLY)
  // Uses the investment's stored dueDay + selected month.
  // The user does NOT manually enter the due date.
  // ============================================================
  const storedDueDay = investment?.dueDay
    || investment?.reminder?.contributionDay
    || (investment?.nextContributionDate
      ? new Date(investment.nextContributionDate).getDate()
      : null)
    || 10; // fallback

  const derivedDueDate = useMemo(() => {
    return deriveDueDateISO(storedDueDay, monthBounds.year, monthBounds.month);
  }, [storedDueDay, monthBounds.year, monthBounds.month]);

  const rawType = String(investment?.type || "").trim().toLowerCase();
  const isGold = rawType === "gold";
  const isRD = rawType === "rd" || rawType === "recurring deposit";
  const isMutualFund = rawType === "mutual fund";
  const isStocks = rawType === "stocks";

  const modalTitle = isRD
    ? "Record RD Installment"
    : isGold
    ? "Record Gold Contribution"
    : isStocks
    ? "Record Stock Purchase / Contribution"
    : isMutualFund
    ? "Record Mutual Fund Contribution"
    : "Record Contribution";

  const [amount, setAmount] = useState(
    investment?.monthlyContribution ? String(investment.monthlyContribution) : ""
  );
  const [paidDate, setPaidDate] = useState(monthBounds.defaultDate);
  const [paymentMethod, setPaymentMethod] = useState(
    investment?.paymentSourceDetails?.paymentMethod || "Cash"
  );
  const [bankName, setBankName] = useState(
    investment?.paymentSourceDetails?.bankName || ""
  );
  const [last4Digits, setLast4Digits] = useState(
    investment?.paymentSourceDetails?.last4Digits || ""
  );
  const [upiId, setUpiId] = useState(
    investment?.paymentSourceDetails?.upiId || ""
  );

  // Type specific additions
  const [weight, setWeight] = useState("");
  const [units, setUnits] = useState("");
  const [quantity, setQuantity] = useState("");

  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [recordedAmount, setRecordedAmount] = useState(0);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState("");

  if (!investment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const contributionAmount = safeNumber(amount);
    if (contributionAmount <= 0) {
      setError("Enter a valid contribution amount.");
      return;
    }

    if (paymentMethod === "Bank Account" && (!bankName.trim() || !last4Digits.trim())) {
      setError("Please provide both the bank name and last 4 digits.");
      return;
    }

    if (paymentMethod === "UPI" && !upiId.trim()) {
      setError("Please provide your UPI ID.");
      return;
    }

    // Open centered confirmation modal before submitting
    setConfirmModalOpen(true);
  };

  const executeContribution = async () => {
    const contributionAmount = safeNumber(amount);
    setIsSubmitting(true);
    setConfirmModalOpen(false);

    try {
      const payload = {
        amount: contributionAmount,
        paidDate,
        status: "Paid",
        note: note.trim(),
        selectedMonth: monthBounds.iso,
        paymentSource: {
          method: paymentMethod,
          bankName: paymentMethod === "Bank Account" ? bankName.trim() : "",
          last4Digits: paymentMethod === "Bank Account" ? last4Digits.trim() : "",
          upiId: paymentMethod === "UPI" ? upiId.trim() : "",
        },
      };

      if (isGold && weight) payload.weight = Number(weight);
      if (isMutualFund && units) payload.units = Number(units);
      if (isStocks && quantity) payload.quantity = Number(quantity);

      const result = await addSIPContribution(investment.id || investment._id, payload);

      if (!result?.success) {
        if (result?.code === "INSUFFICIENT_FUNDS") {
          setIsSubmitting(false);
          onClose();
          return;
        }
        setErrorModalMsg(result?.message || "Unable to record contribution.");
        setErrorModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      setRecordedAmount(contributionAmount);
      setSuccessModalOpen(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      if (err?.code === "INSUFFICIENT_FUNDS") {
        setIsSubmitting(false);
        onClose();
        return;
      }
      setErrorModalMsg(err.message || "An unexpected error occurred.");
      setErrorModalOpen(true);
      setIsSubmitting(false);
    }
  };

  const contributionAmountNum = safeNumber(amount);
  const paymentSourceLabel = paymentMethod === "Bank Account" 
    ? `Bank Account (${bankName || "Bank"} ****${last4Digits || ""})` 
    : paymentMethod === "UPI" 
    ? `UPI (${upiId || ""})` 
    : paymentMethod;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#e2e8dc] bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-[#e7ece3] px-6 py-4">
            <div>
              <h3 className="text-lg font-bold text-[#18392c]">{modalTitle}</h3>
              <p className="mt-1 text-[11px] text-[#6c8b72]">
                {investment.name || "Investment Plan"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-[#f4faef] hover:text-[#315c46] transition-colors"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* CONTENT */}
          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* AMOUNT */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                  Contribution Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-xl border border-[#dce5d7] py-3 pl-10 pr-4 text-sm font-semibold text-[#18392c] shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-[#4d906e] focus:ring-4 focus:ring-[#4d906e]/10"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* PAYMENT SOURCE */}
              <div className="rounded-xl border border-[#e2e8dc] bg-[#f9fbf6] p-3.5 space-y-3">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                  <FiCreditCard size={13} className="text-[#315c46]" />
                  Payment Source *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["Cash", "Bank Account", "UPI"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-lg py-2 text-xs font-semibold border transition ${
                        paymentMethod === m
                          ? "border-[#315c46] bg-[#315c46] text-white shadow-xs"
                          : "border-[#dce5d7] bg-white text-slate-700 hover:bg-[#f4faef]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {paymentMethod === "Bank Account" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#52665b]">Bank Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full rounded-lg border border-[#dce5d7] px-2.5 py-1.5 text-xs text-[#18392c] outline-none focus:border-[#4d906e]"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#52665b]">Last 4 Digits *</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 4321"
                        value={last4Digits}
                        onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ""))}
                        className="w-full rounded-lg border border-[#dce5d7] px-2.5 py-1.5 text-xs text-[#18392c] outline-none focus:border-[#4d906e]"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "UPI" && (
                  <div className="pt-1">
                    <label className="mb-1 block text-[10px] font-semibold text-[#52665b]">UPI ID *</label>
                    <input
                      type="text"
                      placeholder="e.g. user@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full rounded-lg border border-[#dce5d7] px-2.5 py-1.5 text-xs text-[#18392c] outline-none focus:border-[#4d906e]"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>

              {/* TYPE SPECIFIC FIELDS */}
              {isGold && (
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                    Added Weight (Grams - Optional)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 1.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full rounded-xl border border-[#dce5d7] py-2.5 px-3 text-sm font-semibold text-[#18392c] shadow-sm outline-none focus:border-[#4d906e]"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {isMutualFund && (
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                    Units Added (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="e.g. 24.5"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full rounded-xl border border-[#dce5d7] py-2.5 px-3 text-sm font-semibold text-[#18392c] shadow-sm outline-none focus:border-[#4d906e]"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {isStocks && (
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                    Shares / Quantity Added (Optional)
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="e.g. 10"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-[#dce5d7] py-2.5 px-3 text-sm font-semibold text-[#18392c] shadow-sm outline-none focus:border-[#4d906e]"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* DATES GRID */}
              <div className="grid grid-cols-2 gap-4">
                {/* DUE DATE — READ-ONLY, DERIVED FROM STORED */}
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                    <FiLock size={10} className="text-amber-500" />
                    Due Date (Auto)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <FiCalendar />
                    </span>
                    <input
                      type="text"
                      readOnly
                      className="w-full rounded-xl border border-[#e7ece3] bg-[#f9fbf6] py-3 pl-10 pr-4 text-sm font-semibold text-[#18392c] shadow-sm cursor-not-allowed"
                      value={formatDateDisplay(derivedDueDate)}
                      title={`Automatically derived from contribution day ${storedDueDay} + ${monthBounds.formatted}`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[#8fa895]">
                    Day {storedDueDay} of {monthBounds.formatted}
                  </p>
                </div>

                {/* PAID DATE — USER EDITABLE */}
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                    Paid Date *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <FiCalendar />
                    </span>
                    <input
                      type="date"
                      min={monthBounds.minDate}
                      max={monthBounds.maxDate}
                      className="w-full rounded-xl border border-[#dce5d7] py-3 pl-10 pr-4 text-sm font-semibold text-[#18392c] shadow-sm outline-none transition-all focus:border-[#4d906e] focus:ring-4 focus:ring-[#4d906e]/10"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* NOTE */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#52665b]">
                  Note (Optional)
                </label>
                <textarea
                  className="w-full rounded-xl border border-[#dce5d7] p-3 text-sm text-[#18392c] shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-[#4d906e] focus:ring-4 focus:ring-[#4d906e]/10 min-h-[70px]"
                  placeholder="Where should I note? I am paying on this date..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-[#315c46] py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#254635] hover:shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? "Recording..." : modalTitle}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <CenteredModal
        isOpen={confirmModalOpen}
        onClose={() => !isSubmitting && setConfirmModalOpen(false)}
        title="Confirm Contribution"
        message={`Amount: ₹${formatMoney(contributionAmountNum)}\nPayment Source: ${paymentSourceLabel}\nDue Date: ${formatDateDisplay(derivedDueDate)}\nContribution Date: ${formatDateDisplay(paidDate)}\n\nDo you want to record this contribution?`}
        type="confirm"
        iconType="info"
        confirmText={isSubmitting ? "Recording..." : "Confirm"}
        cancelText="Cancel"
        confirmVariant="primary"
        isProcessing={isSubmitting}
        onConfirm={executeContribution}
      />

      {/* SUCCESS MODAL */}
      <CenteredModal
        isOpen={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
          onClose();
        }}
        title="Contribution Added Successfully"
        message={`₹${formatMoney(recordedAmount)} has been added successfully.`}
        type="alert"
        iconType="success"
        confirmText="OK"
        onConfirm={() => {
          setSuccessModalOpen(false);
          onClose();
        }}
      />

      {/* ERROR MODAL */}
      <CenteredModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Something went wrong"
        message={errorModalMsg || "Unable to record contribution. Please try again."}
        type="alert"
        iconType="error"
        confirmText="OK"
        onConfirm={() => setErrorModalOpen(false)}
      />
    </>
  );
}
