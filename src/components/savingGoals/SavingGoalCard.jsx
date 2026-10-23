// ============================================================
// FINANCEOS - SAVING GOAL CARD
// ============================================================
//
// Features:
//
// 1. Goal progress
// 2. Target amount
// 3. Total contributed
// 4. Remaining amount
// 5. Monthly allocation
// 6. Fund location
// 7. Add contribution
// 8. Contribution history
// 9. Pause / Resume goal
// 10. Goal achieved state
// 11. Use / Withdraw goal funds
// 12. Withdrawal history
// 13. Closed goal state
// 14. Edit fund location
// 15. Delete goal
//
// IMPORTANT:
//
// FinanceOS only RECORDS where money is stored.
//
// FinanceOS does NOT actually transfer or withdraw
// money from a bank account.
// ============================================================


// ============================================================
// 1. IMPORTS
// ============================================================

import {
  useState,
} from "react";


import {
  FiTarget,
  FiMapPin,
  FiPlus,
  FiPause,
  FiPlay,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiCheckCircle,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiDollarSign,
  FiX,
  FiEdit3,
  FiBell,
  FiLock,
} from "react-icons/fi";


import useFinance
  from "../../context/useFinance.js";
import { parseSelectedMonth } from "../../utils/monthLifecycle.js";
import { calculateDueDateForMonth, formatDateISO, formatDateDisplay } from "../../utils/dueDateSchedule.js";
import ReminderConfigModal from "../reminders/ReminderConfigModal.jsx";
import CenteredModal from "../common/CenteredModal.jsx";


// ============================================================
// 2. FORMAT MONEY
// ============================================================

function formatMoney(value) {

  const number =
    Number(value || 0);


  if (
    !Number.isFinite(number)
  ) {
    return "0";
  }


  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  );

}


// ============================================================
// 3. FORMAT DATE
// ============================================================

function formatDate(value) {

  if (!value) {
    return "—";
  }


  let date;


  // ----------------------------------------------------------
  // DATE STORED AS YYYY-MM-DD
  // ----------------------------------------------------------

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    date =
      new Date(
        `${value}T00:00:00`
      );

  } else {

    date =
      new Date(value);

  }


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );

}


// ============================================================
// 4. GET TODAY FOR DATE INPUT
// ============================================================

function getToday() {

  const date =
    new Date();


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


// ============================================================
// 5. GET FUND LOCATION TEXT
// ============================================================

function getFundLocationText(location) {

  if (
    !location ||
    !location.type
  ) {

    return "Not recorded";

  }


  const parts = [];


  // ----------------------------------------------------------
  // INSTITUTION
  // ----------------------------------------------------------

  if (
    location.institution
  ) {

    parts.push(
      location.institution
    );

  }


  // ----------------------------------------------------------
  // ACCOUNT / REFERENCE LABEL
  // ----------------------------------------------------------

  if (
    location.label
  ) {

    parts.push(
      location.label
    );

  }


  // ----------------------------------------------------------
  // LAST FOUR DIGITS
  // ----------------------------------------------------------

  if (
    location.lastFour
  ) {

    parts.push(
      `•••• ${location.lastFour}`
    );

  }


  // ----------------------------------------------------------
  // FALLBACK
  // ----------------------------------------------------------

  if (
    parts.length === 0
  ) {

    return location.type;

  }


  return parts.join(
    " • "
  );

}


// ============================================================
// 6. TRANSACTION TIMESTAMP
// ============================================================

function getTransactionTime(transaction) {

  const value =
    transaction?.createdAt ||
    transaction?.date;


  if (!value) {
    return 0;
  }


  let date;


  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    date =
      new Date(
        `${value}T00:00:00`
      );

  } else {

    date =
      new Date(value);

  }


  const time =
    date.getTime();


  return Number.isNaN(time)
    ? 0
    : time;

}


// ============================================================
// 7. MAIN SAVING GOAL CARD
// ============================================================

function SavingGoalCard({
  goal,
}) {


  // ==========================================================
  // FINANCE CONTEXT
  // ==========================================================

  const {
    selectedMonth,
    addGoalContribution,
    updateGoalContribution,
    deleteGoalContribution,
    updateSavingGoal,
    deleteSavingGoal,
    withdrawGoalFunds,
    updateGoalFundLocation,
  } = useFinance();

  const monthBounds = parseSelectedMonth(selectedMonth);


  // ==========================================================
  // UI STATE
  // ==========================================================

  const [
    showContribution,
    setShowContribution,
  ] = useState(false);


  const [
    showWithdrawal,
    setShowWithdrawal,
  ] = useState(false);


  const [
    showHistory,
    setShowHistory,
  ] = useState(false);


  const [
    showFundLocation,
    setShowFundLocation,
  ] = useState(false);


  const [
    message,
    setMessage,
  ] = useState("");

  const [
    showReminderModal,
    setShowReminderModal,
  ] = useState(false);

  const [actionModal, setActionModal] = useState(null);


  const [
    error,
    setError,
  ] = useState("");


  // ==========================================================
  // CONTRIBUTION FORM STATE
  // ==========================================================

  const [
    contributionAmount,
    setContributionAmount,
  ] = useState("");


  const [
    contributionDate,
    setContributionDate,
  ] = useState(
    monthBounds.defaultDate
  );

  const goalDay = goal?.contributionDay || (goal?.reminder && goal?.reminder.contributionDay) || 5;
  const derivedGoalDueDateISO = formatDateISO(
    calculateDueDateForMonth(goalDay, monthBounds.year, monthBounds.month)
  );


  const [
    contributionSource,
    setContributionSource,
  ] = useState(
    "Monthly Savings"
  );


  const [
    contributionNote,
    setContributionNote,
  ] = useState("");


  // ==========================================================
  // WITHDRAWAL FORM STATE
  // ==========================================================

  const [
    withdrawalAmount,
    setWithdrawalAmount,
  ] = useState("");


  const [
    withdrawalDate,
    setWithdrawalDate,
  ] = useState(
    monthBounds.defaultDate
  );


  const [
    withdrawalPurpose,
    setWithdrawalPurpose,
  ] = useState("");


  const [
    withdrawalNote,
    setWithdrawalNote,
  ] = useState("");


  // ==========================================================
  // FUND LOCATION FORM STATE
  // ==========================================================

  const [
    fundLocationType,
    setFundLocationType,
  ] = useState(
    goal?.fundLocation?.type ||
    ""
  );


  const [
    institution,
    setInstitution,
  ] = useState(
    goal?.fundLocation?.institution ||
    ""
  );


  const [
    accountLabel,
    setAccountLabel,
  ] = useState(
    goal?.fundLocation?.label ||
    ""
  );


  const [
    lastFour,
    setLastFour,
  ] = useState(
    goal?.fundLocation?.lastFour ||
    ""
  );


  // ==========================================================
  // TARGET AMOUNT
  // ==========================================================

  const targetAmount =
    Math.max(
      Number(
        goal?.targetAmount ||
        0
      ),
      0
    );


  // ==========================================================
  // TOTAL CONTRIBUTED
  // ==========================================================

  const totalContributed =
  Math.max(
    Number(
      goal?.totalContributed ??
      goal?.savedAmount ??
      goal?.currentAmount ??
      0
    ),
    0
  );


  // ==========================================================
  // TOTAL WITHDRAWN
  // ==========================================================

  const totalWithdrawn =
    Math.max(
      Number(
        goal?.totalWithdrawn ||
        0
      ),
      0
    );


  // ==========================================================
  // AVAILABLE GOAL FUND
  // ==========================================================

  const availableGoalFund =
    Math.max(
      Number(
        goal?.availableGoalFund ??
        (
          totalContributed -
          totalWithdrawn
        )
      ),
      0
    );


  // ==========================================================
  // MONTHLY CONTRIBUTION
  // ==========================================================

  const monthlyContribution =
    Math.max(
      Number(
        goal?.monthlyContribution ||
        goal?.monthlyAllocation ||
        goal?.requiredMonthly ||
        0
      ),
      0
    );


  // ==========================================================
  // REMAINING TO TARGET
  // ==========================================================

  const remainingToTarget =
    Math.max(
      targetAmount -
      totalContributed,
      0
    );


  // ==========================================================
  // PROGRESS
  // ==========================================================

  const progress =
    targetAmount > 0

      ? Math.min(
          (
            totalContributed /
            targetAmount
          ) * 100,
          100
        )

      : 0;


  // ==========================================================
  // STATUS
  // ==========================================================

  const status =
    goal?.status ||
    "Active";


  const isActive =
    status ===
    "Active";


  const isPaused =
    status ===
    "Paused";


  const isCompleted =
    status ===
    "Completed";


  const isClosed =
    status ===
    "Closed";


  // ==========================================================
  // GOAL ACHIEVED
  // ==========================================================

  const goalAchieved =
    targetAmount > 0 &&
    totalContributed >=
      targetAmount;


  // ==========================================================
  // TRANSACTIONS
  // ==========================================================
  //
  // IMPORTANT:
  //
  // We intentionally do NOT use useMemo here.
  //
  // The previous version caused:
  //
  // "Compilation Skipped:
  // Existing memoization could not be preserved"
  //
  // This list is small, so direct sorting is perfectly fine.
  // ==========================================================

  const transactions =
    Array.isArray(
      goal?.transactions
    )
      ? [
          ...goal.transactions,
        ].sort(
          (
            first,
            second
          ) =>
            getTransactionTime(
              second
            ) -
            getTransactionTime(
              first
            )
        )
      : [];


  // ==========================================================
  // FUND LOCATION TEXT
  // ==========================================================

  const locationText =
    getFundLocationText(
      goal?.fundLocation
    );


  // ==========================================================
  // DOES LOCATION REQUIRE INSTITUTION?
  // ==========================================================

  const requiresInstitution =
    [
      "Bank Account",
      "Fixed Deposit",
      "Recurring Deposit",
      "Investment",
    ].includes(
      fundLocationType
    );


  // ==========================================================
  // CLEAR FEEDBACK
  // ==========================================================

  const clearFeedback =
    () => {

      setError("");

      setMessage("");

    };


  // ==========================================================
  // HANDLE ADD CONTRIBUTION
  // ==========================================================

  const handleContribution =
    async (event) => {

      event.preventDefault();


      clearFeedback();


      const amount =
        Number(
          contributionAmount
        );


      // -------------------------------------------------------
      // VALIDATE AMOUNT
      // -------------------------------------------------------

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        setError(
          "Enter a valid contribution amount."
        );

        return;

      }


      // -------------------------------------------------------
      // CLOSED GOAL
      // -------------------------------------------------------

      if (
        isClosed
      ) {

        setError(
          "This goal is closed."
        );

        return;

      }


      // -------------------------------------------------------
      // RECORD CONTRIBUTION
      // -------------------------------------------------------

      try {
        await addGoalContribution(
          goal._id || goal.id,
          {

            amount,

            date:
              contributionDate,

            source:
              contributionSource,

            note:
              contributionNote.trim(),

          }
        );

        // -------------------------------------------------------
        // PROJECT TOTAL
        // -------------------------------------------------------

        const projectedTotal =
          totalContributed +
          amount;


        // -------------------------------------------------------
        // RESET FORM
        // -------------------------------------------------------

        setContributionAmount(
          ""
        );


        setContributionNote(
          ""
        );


        setContributionDate(
          monthBounds.defaultDate
        );


        setShowContribution(
          false
        );


        // -------------------------------------------------------
        // SUCCESS MESSAGE
        // -------------------------------------------------------

        if (
          targetAmount > 0 &&
          projectedTotal >=
            targetAmount
        ) {


        setMessage(
          `${goal?.goalName || goal?.name || "Goal"} has reached its target..`
        );

      } else {

        setMessage(
          `₹${formatMoney(
            amount
          )} contribution recorded.`
        );

      }
      } catch (err) {
        if (err?.code === "INSUFFICIENT_FUNDS") {
          setShowContribution(false);
          return;
        }
        setError(err.message || "Failed to add contribution.");
      }
    };

  // ==========================================================
  // HANDLE DELETE CONTRIBUTION
  // ==========================================================

  const handleDeleteContribution = async (contributionId) => {
    if (!contributionId) return;
    try {
      clearFeedback();
      await deleteGoalContribution(goal._id || goal.id, contributionId);
      setMessage("Contribution removed successfully.");
    } catch (err) {
      setError(err.message || "Failed to delete contribution.");
    }
  };


  // ==========================================================
  // HANDLE WITHDRAWAL / USE FUNDS
  // ==========================================================

  const handleWithdrawal =
    (event) => {

      event.preventDefault();


      clearFeedback();


      const amount =
        Number(
          withdrawalAmount
        );


      // -------------------------------------------------------
      // VALID AMOUNT
      // -------------------------------------------------------

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        setError(
          "Enter a valid amount to use."
        );

        return;

      }


      // -------------------------------------------------------
      // GOAL MUST BE ACHIEVED
      // -------------------------------------------------------

      if (
        !goalAchieved
      ) {

        setError(
          "Goal funds can be used after the target has been achieved."
        );

        return;

      }


      // -------------------------------------------------------
      // AVAILABLE FUND
      // -------------------------------------------------------

      if (
        availableGoalFund <= 0
      ) {

        setError(
          "No goal funds are currently available."
        );

        return;

      }


      // -------------------------------------------------------
      // PREVENT OVER-WITHDRAWAL
      // -------------------------------------------------------

      if (
        amount >
        availableGoalFund
      ) {

        setError(
          `Only ₹${formatMoney(
            availableGoalFund
          )} is available in this goal.`
        );

        return;

      }


      // -------------------------------------------------------
      // PURPOSE REQUIRED
      // -------------------------------------------------------

      if (
        !withdrawalPurpose.trim()
      ) {

        setError(
          "Enter what the goal fund is being used for."
        );

        return;

      }


      // -------------------------------------------------------
      // RECORD WITHDRAWAL
      // -------------------------------------------------------

      withdrawGoalFunds(
        goal._id || goal.id,
        {

          amount,

          date:
            withdrawalDate,

          purpose:
            withdrawalPurpose.trim(),

          note:
            withdrawalNote.trim(),

        }
      );


      // -------------------------------------------------------
      // CALCULATE REMAINING
      // -------------------------------------------------------

      const remaining =
        Math.max(
          availableGoalFund -
          amount,
          0
        );


      // -------------------------------------------------------
      // RESET FORM
      // -------------------------------------------------------

      setWithdrawalAmount(
        ""
      );


      setWithdrawalPurpose(
        ""
      );


      setWithdrawalNote(
        ""
      );


      setWithdrawalDate(
        getToday()
      );


      setShowWithdrawal(
        false
      );


      // -------------------------------------------------------
      // SUCCESS MESSAGE
      // -------------------------------------------------------

      if (
        remaining <= 0
      ) {

        setMessage(
          "All available goal funds have been used. The goal is now closed."
        );

      } else {

        setMessage(
          `Goal fund usage recorded. ₹${formatMoney(
            remaining
          )} remains available.`
        );

      }

    };


  // ==========================================================
  // HANDLE FUND LOCATION
  // ==========================================================

  const handleFundLocation =
    async (event) => {

      event.preventDefault();


      clearFeedback();


      // -------------------------------------------------------
      // LOCATION TYPE
      // -------------------------------------------------------

      if (
        !fundLocationType
      ) {

        setError(
          "Select where the goal money is stored."
        );

        return;

      }


      // -------------------------------------------------------
      // INSTITUTION
      // -------------------------------------------------------

      if (
        requiresInstitution &&
        !institution.trim()
      ) {

        setError(
          "Enter the bank or institution name."
        );

        return;

      }


      // -------------------------------------------------------
      // LAST FOUR DIGITS
      // -------------------------------------------------------

      if (
        lastFour &&
        !/^\d{4}$/.test(
          lastFour
        )
      ) {

        setError(
          "Last 4 digits must contain exactly 4 numbers."
        );

        return;

      }


      // -------------------------------------------------------
      // UPDATE LOCATION
      // -------------------------------------------------------

      try {
        await updateGoalFundLocation(
          goal._id || goal.id,
          {

            type:
              fundLocationType,

            institution:
              institution.trim(),

            label:
              accountLabel.trim(),

            lastFour,

          }
        );


        setShowFundLocation(
          false
        );


        setMessage(
          "Goal fund location updated."
        );
      } catch (err) {
        setError(err.message || "Failed to update fund location.");
      }

    };


  // ==========================================================
  // HANDLE PAUSE
  // ==========================================================

  const handlePause =
    () => {

      clearFeedback();


      updateSavingGoal(
        goal._id || goal.id,
        {

          status:
            "Paused",

        }
      );


      setMessage(
        "Goal paused."
      );

    };


  // ==========================================================
  // HANDLE RESUME
  // ==========================================================

  const handleResume =
    () => {

      clearFeedback();


      updateSavingGoal(
        goal._id || goal.id,
        {

          status:
            "Active",

        }
      );


      setMessage(
        "Goal resumed."
      );

    };


  // ==========================================================
  // HANDLE DELETE
  // ==========================================================

  const handleDelete = () => {
    setActionModal({
      isOpen: true,
      title: "Are you sure you want to delete this saving goal?",
      message: `Delete "${goal?.name || "this saving goal"}"? Its recorded transaction history will also be removed.`,
      confirmText: "Delete",
      confirmVariant: "danger",
      cancelText: "Cancel",
      onConfirm: async () => {
        setActionModal(null);
        await deleteSavingGoal(goal._id || goal.id);
      },
      onCancel: () => setActionModal(null),
    });
  };


  // ==========================================================
  // OPEN FUND LOCATION EDITOR
  // ==========================================================

  const openFundLocationEditor =
    () => {

      clearFeedback();


      setFundLocationType(
        goal?.fundLocation?.type ||
        ""
      );


      setInstitution(
        goal?.fundLocation?.institution ||
        ""
      );


      setAccountLabel(
        goal?.fundLocation?.label ||
        ""
      );


      setLastFour(
        goal?.fundLocation?.lastFour ||
        ""
      );


      setShowFundLocation(
        !showFundLocation
      );

    };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="rounded-2xl border border-[#e2e8dc] bg-white p-5">


      {/* ======================================================
          HEADER
         ====================================================== */}

      <div className="flex items-start justify-between gap-4">


        <div className="min-w-0">


          <div className="flex items-center gap-3">


            {/* ICON */}

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f7f1] text-[#315c46]">

              <FiTarget />

            </div>


            {/* GOAL NAME */}

            <div className="min-w-0">


              <h3 className="truncate text-sm font-semibold text-[#18392c]">

                {goal?.goalName || goal?.name || "Saving Goal"}

              </h3>


              <div className="mt-1 flex flex-wrap items-center gap-2">

                <p className="text-[10px] text-slate-400">

                  {goal?.targetDate
                    ? `Target ${formatDate(
                        goal.targetDate
                      )}`
                    : "Saving Goal"}

                </p>

                {goal?.reminder?.enabled ? (
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-[#edf5e8] px-2 py-0.5 text-[9px] font-bold text-[#315c46] hover:bg-[#dfeecd] transition cursor-pointer"
                    title="Click to manage reminder"
                  >
                    <FiBell size={9} />
                    Day {goal.reminder.contributionDay || goalDay} • {
                      [
                        goal.reminder.channels?.inApp !== false ? "In-App" : null,
                        goal.reminder.channels?.email ? "Email" : null,
                      ].filter(Boolean).join(", ") || "In-App"
                    }
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500 hover:bg-slate-200 transition cursor-pointer"
                    title="Click to enable reminder"
                  >
                    <FiBell size={9} />
                    Set Reminder
                  </button>
                )}

              </div>


            </div>


          </div>


        </div>


        {/* STATUS */}

        <StatusBadge
          status={
            status
          }
        />


      </div>


      {/* ======================================================
          GOAL ACHIEVED MESSAGE
         ====================================================== */}

      {isCompleted &&
        availableGoalFund > 0 && (

        <div className="mt-5 rounded-xl border border-[#cfe5c5] bg-[#f4faef] p-4">


          <div className="flex items-start gap-3">


            <FiCheckCircle className="mt-0.5 shrink-0 text-[#315c46]" />


            <div>


              <p className="text-xs font-semibold text-[#18392c]">
                Goal Achieved
              </p>


              <p className="mt-1 text-[11px] leading-5 text-[#5f7568]">

                You reached your{" "}

                <span className="font-semibold">

                  ₹{formatMoney(
                    targetAmount
                  )}

                </span>{" "}

                target for{" "}

                <span className="font-semibold">

                  {goal?.name ||
                    "this goal"}

                </span>.

              </p>


              <p className="mt-1 text-[11px] leading-5 text-[#5f7568]">

                ₹{formatMoney(
                  availableGoalFund
                )} is currently recorded as available for this goal.

              </p>


              {goal?.fundLocation?.type && (

                <p className="mt-1 text-[11px] leading-5 text-[#5f7568]">

                  Funds recorded in:{" "}

                  <span className="font-semibold text-[#315c46]">

                    {locationText}

                  </span>

                </p>

              )}


            </div>


          </div>


        </div>

      )}


      {/* ======================================================
          CLOSED MESSAGE
         ====================================================== */}

      {isClosed && (

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">


          <div className="flex items-start gap-3">


            <FiCheckCircle className="mt-0.5 shrink-0 text-slate-500" />


            <div>


              <p className="text-xs font-semibold text-slate-700">
                Goal Closed
              </p>


              <p className="mt-1 text-[11px] leading-5 text-slate-500">

                This goal was achieved and all recorded goal funds have been used.

              </p>


            </div>


          </div>


        </div>

      )}


      {/* ======================================================
          GOAL PROGRESS
         ====================================================== */}

      <div className="mt-5">


        <div className="flex items-center justify-between">


          <p className="text-[10px] font-medium text-slate-400">
            Goal Progress
          </p>


          <p className="text-xs font-semibold text-[#315c46]">

            {progress.toFixed(
              0
            )}%

          </p>


        </div>


        {/* PROGRESS BAR */}

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1e9]">


          <div
            className="h-full rounded-full bg-[#315c46] transition-all duration-300"
            style={{

              width:
                `${progress}%`,

            }}
          />


        </div>


        {/* TOTAL / TARGET */}

        <div className="mt-3 flex items-end justify-between gap-4">


          <div>


            <p className="text-[10px] text-slate-400">
              Total Contributed
            </p>


            <p className="mt-1 text-lg font-bold text-[#18392c]">

              ₹{formatMoney(
                totalContributed
              )}

            </p>


          </div>


          <div className="text-right">


            <p className="text-[10px] text-slate-400">
              Target
            </p>


            <p className="mt-1 text-sm font-semibold text-[#52665b]">

              ₹{formatMoney(
                targetAmount
              )}

            </p>


          </div>


        </div>


      </div>


      {/* ======================================================
          FINANCIAL DETAILS
         ====================================================== */}

      <div className="mt-5 grid grid-cols-2 gap-3">


        <InfoBox

          label={
            goalAchieved
              ? "Available Goal Fund"
              : "Remaining to Target"
          }

          value={
            goalAchieved

              ? `₹${formatMoney(
                  availableGoalFund
                )}`

              : `₹${formatMoney(
                  remainingToTarget
                )}`
          }

        />


        <InfoBox

          label="Monthly Allocation"

          value={`₹${formatMoney(
            monthlyContribution
          )}`}

        />


        <InfoBox

          label="Used / Withdrawn"

          value={`₹${formatMoney(
            totalWithdrawn
          )}`}

        />


        <InfoBox

          label="Duration"

          value={
            goal?.durationMonths
              ? `${goal.durationMonths} months`
              : "—"
          }

        />


      </div>


      {/* ======================================================
          FUND LOCATION
         ====================================================== */}

      <div className="mt-5 rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-4">


        <div className="flex items-start justify-between gap-3">


          <div className="flex min-w-0 items-start gap-3">


            <FiMapPin className="mt-0.5 shrink-0 text-[#315c46]" />


            <div className="min-w-0">


              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Fund Location
              </p>


              <p className="mt-1 break-words text-xs font-semibold text-[#18392c]">

                {locationText}

              </p>


              {goal?.fundLocation?.type && (

                <p className="mt-1 text-[10px] text-slate-400">

                  {goal.fundLocation.type}

                </p>

              )}


            </div>


          </div>


          {/* EDIT LOCATION */}

          {!isClosed && (

            <button
              type="button"
              onClick={
                openFundLocationEditor
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#315c46] transition hover:bg-white"
              title="Edit fund location"
            >

              <FiEdit3 />

            </button>

          )}


        </div>


        {/* ====================================================
            FUND LOCATION FORM
           ==================================================== */}

        {showFundLocation && (

          <form
            onSubmit={
              handleFundLocation
            }
            className="mt-4 border-t border-[#e2e8dc] pt-4"
          >


            {/* LOCATION TYPE */}

            <FieldLabel>
              Where is this money stored?
            </FieldLabel>


            <select
              value={
                fundLocationType
              }
              onChange={(event) => {

                setFundLocationType(
                  event.target.value
                );


                setInstitution(
                  ""
                );


                setAccountLabel(
                  ""
                );


                setLastFour(
                  ""
                );

              }}
              className={inputClass}
            >


              <option value="">
                Select fund location
              </option>


              <option value="Bank Account">
                Bank Account
              </option>


              <option value="Cash">
                Cash
              </option>


              <option value="Fixed Deposit">
                Fixed Deposit
              </option>


              <option value="Recurring Deposit">
                Recurring Deposit
              </option>


              <option value="Investment">
                Investment
              </option>


              <option value="Other">
                Other
              </option>


            </select>


            {/* INSTITUTION */}

            {requiresInstitution && (

              <div className="mt-3">


                <FieldLabel>

                  {fundLocationType ===
                  "Bank Account"
                    ? "Bank Name"
                    : "Institution Name"}

                </FieldLabel>


                <input
                  type="text"
                  value={
                    institution
                  }
                  onChange={(event) =>
                    setInstitution(
                      event.target.value
                    )
                  }
                  placeholder={
                    fundLocationType ===
                    "Bank Account"
                      ? "Example: SBI"
                      : "Institution name"
                  }
                  className={inputClass}
                />


              </div>

            )}


            {/* ACCOUNT LABEL */}

            {fundLocationType &&
              fundLocationType !==
                "Cash" &&
              fundLocationType !==
                "Other" && (

              <div className="mt-3">


                <FieldLabel>
                  Account / Reference Label
                </FieldLabel>


                <input
                  type="text"
                  value={
                    accountLabel
                  }
                  onChange={(event) =>
                    setAccountLabel(
                      event.target.value
                    )
                  }
                  placeholder="Example: Phone Goal Savings"
                  className={inputClass}
                />


              </div>

            )}


            {/* LAST FOUR */}

            {fundLocationType ===
              "Bank Account" && (

              <div className="mt-3">


                <FieldLabel>
                  Last 4 Account Digits
                </FieldLabel>


                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={
                    lastFour
                  }
                  onChange={(event) => {

                    const value =
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          4
                        );


                    setLastFour(
                      value
                    );

                  }}
                  placeholder="1234"
                  className={inputClass}
                />


              </div>

            )}


            {/* OTHER LOCATION */}

            {fundLocationType ===
              "Other" && (

              <div className="mt-3">


                <FieldLabel>
                  Location Description
                </FieldLabel>


                <input
                  type="text"
                  value={
                    accountLabel
                  }
                  onChange={(event) =>
                    setAccountLabel(
                      event.target.value
                    )
                  }
                  placeholder="Example: Separate savings envelope"
                  className={inputClass}
                />


              </div>

            )}


            {/* LOCATION BUTTONS */}

            <div className="mt-4 flex justify-end gap-2">


              <button
                type="button"
                onClick={() =>
                  setShowFundLocation(
                    false
                  )
                }
                className={secondaryButtonClass}
              >

                Cancel

              </button>


              <button
                type="submit"
                className={primaryButtonClass}
              >

                Save Location

              </button>


            </div>


          </form>

        )}


      </div>


      {/* ======================================================
          ERROR MESSAGE
         ====================================================== */}

      {error && (

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">


          <div className="flex items-start justify-between gap-3">


            <p className="text-[11px] leading-5 text-red-600">

              {error}

            </p>


            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-red-400"
            >

              <FiX />

            </button>


          </div>


        </div>

      )}


      {/* ======================================================
          SUCCESS MESSAGE
         ====================================================== */}

      {message && (

        <div className="mt-4 rounded-xl border border-[#d7ead0] bg-[#f4faef] p-3">


          <div className="flex items-start justify-between gap-3">


            <p className="text-[11px] leading-5 text-[#315c46]">

              {message}

            </p>


            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              className="text-[#5f7568]"
            >

              <FiX />

            </button>


          </div>


        </div>

      )}


      {/* ======================================================
          CONTRIBUTION FORM
         ====================================================== */}

      {showContribution &&
        !isClosed && (

        <form
          onSubmit={
            handleContribution
          }
          className="mt-5 rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-4"
        >


          {/* FORM HEADER */}

          <div className="flex items-center justify-between">


            <div>


              <p className="text-xs font-semibold text-[#18392c]">
                Record Contribution
              </p>


              <p className="mt-1 text-[10px] text-slate-400">

                Record money you have set aside for this goal.

              </p>


            </div>


            <button
              type="button"
              onClick={() =>
                setShowContribution(
                  false
                )
              }
              className="text-slate-400"
            >

              <FiX />

            </button>


          </div>


          {/* AMOUNT */}

          <div className="mt-4">


            <FieldLabel>
              Contribution Amount
            </FieldLabel>


            <MoneyInput

              value={
                contributionAmount
              }

              onChange={
                setContributionAmount
              }

              placeholder={
                monthlyContribution > 0

                  ? String(
                      Math.round(
                        monthlyContribution
                      )
                    )

                  : "5000"
              }

            />


          </div>


          {/* SCHEDULED DUE DATE (AUTO) */}

          <div className="mt-3">

            <FieldLabel>
              <span className="inline-flex items-center gap-1">
                <FiLock size={10} className="text-amber-500" />
                Scheduled Due Date (Auto)
              </span>
            </FieldLabel>

            <input
              type="text"
              readOnly
              value={formatDateDisplay(derivedGoalDueDateISO)}
              title={`Automatically derived from contribution day ${goalDay} for ${monthBounds.formatted}`}
              className={`${inputClass} bg-[#f9fbf6] cursor-not-allowed`}
            />

            <p className="mt-1 text-[10px] text-[#8fa895]">
              Day {goalDay} of {monthBounds.formatted}
            </p>

          </div>


          {/* ACTUAL PAID / CONTRIBUTION DATE */}

          <div className="mt-3">

            <FieldLabel>
              Contribution Date
            </FieldLabel>

            <input
              type="date"
              min={monthBounds.minDate}
              max={monthBounds.maxDate}
              value={
                contributionDate || monthBounds.defaultDate
              }
              onChange={(event) =>
                setContributionDate(
                  event.target.value
                )
              }
              className={inputClass}
            />

          </div>


          {/* SOURCE */}

          <div className="mt-3">


            <FieldLabel>
              Source
            </FieldLabel>


            <select
              value={
                contributionSource
              }
              onChange={(event) =>
                setContributionSource(
                  event.target.value
                )
              }
              className={inputClass}
            >


              <option value="Monthly Savings">
                Monthly Savings
              </option>


              <option value="Existing Savings">
                Existing Savings
              </option>


              <option value="Cash Savings">
                Cash Savings
              </option>


              <option value="Salary">
                Salary
              </option>


              <option value="Bonus">
                Bonus
              </option>


              <option value="Gift">
                Gift
              </option>


              <option value="Other">
                Other
              </option>


            </select>


          </div>


          {/* NOTE */}

          <div className="mt-3">


            <FieldLabel>
              Note (Optional)
            </FieldLabel>


            <input
              type="text"
              value={
                contributionNote
              }
              onChange={(event) =>
                setContributionNote(
                  event.target.value
                )
              }
              placeholder="Example: July contribution"
              className={inputClass}
            />


          </div>


          {/* LOCATION */}

          <div className="mt-4 rounded-lg bg-white p-3">


            <p className="text-[10px] text-slate-400">
              Funds will be recorded at
            </p>


            <p className="mt-1 text-xs font-semibold text-[#315c46]">

              {locationText}

            </p>


          </div>


          {/* BUTTONS */}

          <div className="mt-4 flex justify-end gap-2">


            <button
              type="button"
              onClick={() =>
                setShowContribution(
                  false
                )
              }
              className={secondaryButtonClass}
            >

              Cancel

            </button>


            <button
              type="submit"
              className={primaryButtonClass}
            >

              Record Contribution

            </button>


          </div>


        </form>

      )}


      {/* ======================================================
          WITHDRAWAL FORM
         ====================================================== */}

      {showWithdrawal &&
        goalAchieved &&
        !isClosed && (

        <form
          onSubmit={
            handleWithdrawal
          }
          className="mt-5 rounded-xl border border-[#d7ead0] bg-[#f4faef] p-4"
        >


          {/* HEADER */}

          <div className="flex items-center justify-between">


            <div>


              <p className="text-xs font-semibold text-[#18392c]">
                Use Goal Funds
              </p>


              <p className="mt-1 text-[10px] text-[#5f7568]">

                Record money you have used or withdrawn from this goal.

              </p>


            </div>


            <button
              type="button"
              onClick={() =>
                setShowWithdrawal(
                  false
                )
              }
              className="text-[#5f7568]"
            >

              <FiX />

            </button>


          </div>


          {/* SUMMARY */}

          <div className="mt-4 grid grid-cols-2 gap-3">


            <InfoBox

              label="Available"

              value={`₹${formatMoney(
                availableGoalFund
              )}`}

            />


            <InfoBox

              label="Stored In"

              value={
                goal?.fundLocation?.institution ||
                goal?.fundLocation?.type ||
                "Not recorded"
              }

            />


          </div>


          {/* AMOUNT */}

          <div className="mt-4">


            <FieldLabel>
              Amount to Use
            </FieldLabel>


            <MoneyInput

              value={
                withdrawalAmount
              }

              onChange={
                setWithdrawalAmount
              }

              placeholder={
                String(
                  Math.round(
                    availableGoalFund
                  )
                )
              }

            />


          </div>


          {/* DATE */}

          <div className="mt-3">


            <FieldLabel>
              Date
            </FieldLabel>


            <input
              type="date"
              value={
                withdrawalDate
              }
              onChange={(event) =>
                setWithdrawalDate(
                  event.target.value
                )
              }
              className={inputClass}
            />


          </div>


          {/* PURPOSE */}

          <div className="mt-3">


            <FieldLabel>
              Purpose
            </FieldLabel>


            <input
              type="text"
              value={
                withdrawalPurpose
              }
              onChange={(event) =>
                setWithdrawalPurpose(
                  event.target.value
                )
              }
              placeholder={`Example: Purchased ${goal?.name || "goal item"}`}
              className={inputClass}
            />


          </div>


          {/* NOTE */}

          <div className="mt-3">


            <FieldLabel>
              Note (Optional)
            </FieldLabel>


            <input
              type="text"
              value={
                withdrawalNote
              }
              onChange={(event) =>
                setWithdrawalNote(
                  event.target.value
                )
              }
              placeholder="Optional details"
              className={inputClass}
            />


          </div>


          {/* INFORMATION */}

          <div className="mt-4 rounded-lg border border-[#d7ead0] bg-white p-3">


            <p className="text-[10px] leading-5 text-[#5f7568]">

              This records that you used the goal money.

              FinanceOS does not perform a real withdrawal
              from your bank account.

            </p>


          </div>


          {/* BUTTONS */}

          <div className="mt-4 flex justify-end gap-2">


            <button
              type="button"
              onClick={() =>
                setShowWithdrawal(
                  false
                )
              }
              className={secondaryButtonClass}
            >

              Cancel

            </button>


            <button
              type="submit"
              className={primaryButtonClass}
            >

              Confirm Use

            </button>


          </div>


        </form>

      )}


      {/* ======================================================
          TRANSACTION HISTORY
         ====================================================== */}

      <div className="mt-5 border-t border-[#edf0e9] pt-4">


        {/* HISTORY BUTTON */}

        <button
          type="button"
          onClick={() =>
            setShowHistory(
              !showHistory
            )
          }
          className="flex w-full items-center justify-between text-left"
        >


          <div>


            <p className="text-xs font-semibold text-[#18392c]">
              Transaction History
            </p>


            <p className="mt-1 text-[10px] text-slate-400">

              {transactions.length}{" "}

              {transactions.length === 1
                ? "transaction"
                : "transactions"}

            </p>


          </div>


          {showHistory ? (

            <FiChevronUp className="text-[#315c46]" />

          ) : (

            <FiChevronDown className="text-[#315c46]" />

          )}


        </button>


        {/* HISTORY LIST */}

        {showHistory && (

          <div className="mt-4 space-y-2">


            {transactions.length ===
            0 ? (

              <div className="rounded-xl bg-[#fafcf8] p-4 text-center">


                <p className="text-[11px] text-slate-400">

                  No goal transactions recorded yet.

                </p>


              </div>

            ) : (

              transactions.map(
                (
                  transaction,
                  index
                ) => {


                  // -------------------------------------------
                  // DETERMINE TRANSACTION TYPE
                  // -------------------------------------------

                  const isWithdrawal =
                    transaction?.type ===
                    "withdrawal";


                  return (

                    <div
                      key={
                        transaction?.id ||
                        `${transaction?.type || "transaction"}-${index}`
                      }
                      className="flex items-start justify-between gap-3 rounded-xl bg-[#fafcf8] p-3"
                    >


                      {/* LEFT */}

                      <div className="flex min-w-0 items-start gap-3">


                        {/* ICON */}

                        <div
                          className={
                            isWithdrawal

                              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"

                              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf6e8] text-[#315c46]"
                          }
                        >

                          {isWithdrawal ? (

                            <FiArrowDownCircle />

                          ) : (

                            <FiArrowUpCircle />

                          )}


                        </div>


                        {/* DETAILS */}

                        <div className="min-w-0">


                          <p className="text-xs font-semibold text-[#18392c]">

                            {isWithdrawal

                              ? transaction?.purpose ||
                                "Goal Fund Used"

                              : transaction?.source ||
                                "Contribution"}

                          </p>


                          <p className="mt-1 text-[10px] text-slate-400">

                            {formatDate(
                              transaction?.date
                            )}

                          </p>


                          {transaction?.note && (

                            <p className="mt-1 break-words text-[10px] leading-4 text-slate-400">

                              {transaction.note}

                            </p>

                          )}


                        </div>


                      </div>


                      {/* AMOUNT & ACTIONS */}

                      <div className="flex items-center gap-2 shrink-0">

                        <p
                          className={
                            isWithdrawal
                              ? "text-xs font-bold text-slate-600"
                              : "text-xs font-bold text-[#315c46]"
                          }
                        >

                          {isWithdrawal
                            ? "-"
                            : "+"}

                          ₹{formatMoney(
                            transaction?.amount
                          )}

                        </p>

                        {!isWithdrawal && (transaction?._id || transaction?.id) && (
                          <button
                            type="button"
                            title="Remove contribution"
                            onClick={() => handleDeleteContribution(transaction?._id || transaction?.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition rounded"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        )}

                      </div>

                    </div>

                  );

                }
              )

            )}


          </div>

        )}


      </div>


      {/* ======================================================
          ACTION BUTTONS
         ====================================================== */}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#edf0e9] pt-4">


        {/* ADD CONTRIBUTION */}

        {(isActive ||
          isPaused) &&
          !goalAchieved && (

          <button
            type="button"
            onClick={() => {

              clearFeedback();


              setShowContribution(
                !showContribution
              );


              setShowWithdrawal(
                false
              );

            }}
            className={primaryButtonClass}
          >

            <FiPlus />

            Add Contribution

          </button>

        )}


        {/* PAUSE */}

        {isActive &&
          !goalAchieved && (

          <button
            type="button"
            onClick={
              handlePause
            }
            className={secondaryButtonClass}
          >

            <FiPause />

            Pause

          </button>

        )}


        {/* RESUME */}

        {isPaused &&
          !goalAchieved && (

          <button
            type="button"
            onClick={
              handleResume
            }
            className={secondaryButtonClass}
          >

            <FiPlay />

            Resume

          </button>

        )}


        {/* USE FUNDS */}

        {isCompleted &&
          availableGoalFund > 0 && (

          <button
            type="button"
            onClick={() => {

              clearFeedback();


              setShowWithdrawal(
                !showWithdrawal
              );


              setShowContribution(
                false
              );

            }}
            className={primaryButtonClass}
          >

            <FiDollarSign />

            Use / Withdraw Funds

          </button>

        )}


        {/* REMINDER */}
        <button
          type="button"
          onClick={() => setShowReminderModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce5d7] bg-white px-3 py-2 text-[11px] font-semibold text-[#315c46] transition hover:bg-[#f2f7f0]"
        >
          <FiBell className="text-xs" />
          {goal?.reminder?.enabled ? "Reminder" : "Set Reminder"}
        </button>

        {/* DELETE */}

        <button
          type="button"
          onClick={
            handleDelete
          }
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-[11px] font-semibold text-red-500 transition hover:bg-red-50"
        >

          <FiTrash2 />

          Delete

        </button>


      </div>

      {/* REMINDER MODAL */}
      {showReminderModal && (
        <ReminderConfigModal
          isOpen={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          sourceType="SavingGoal"
          sourceId={goal._id || goal.id}
          itemName={goal.goalName || goal.name || "Saving Goal"}
          amount={Number(goal.monthlyContribution || goal.targetAmount || 0)}
          dueDate={formatDateISO(new Date(new Date().getFullYear(), new Date().getMonth(), Number(goalDay) || 5))}
          initialData={goal}
        />
      )}

      {actionModal && <CenteredModal {...actionModal} />}

    </div>

  );

}


// ============================================================
// 8. STATUS BADGE
// ============================================================

function StatusBadge({
  status,
}) {


  const classes = {

    Active:
      "bg-[#edf6e8] text-[#315c46]",

    Paused:
      "bg-amber-50 text-amber-600",

    Completed:
      "bg-[#e8f3e2] text-[#315c46]",

    Closed:
      "bg-slate-100 text-slate-500",

  };


  return (

    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold ${
        classes[status] ||
        "bg-slate-100 text-slate-500"
      }`}
    >

      {status}

    </span>

  );

}


// ============================================================
// 9. INFO BOX
// ============================================================

function InfoBox({
  label,
  value,
}) {

  return (

    <div className="min-w-0 rounded-xl bg-[#fafcf8] p-3">


      <p className="text-[9px] text-slate-400">

        {label}

      </p>


      <p className="mt-1 break-words text-xs font-semibold text-[#18392c]">

        {value}

      </p>


    </div>

  );

}


// ============================================================
// 10. FIELD LABEL
// ============================================================

function FieldLabel({
  children,
}) {

  return (

    <label className="mb-1.5 block text-[10px] font-semibold text-[#52665b]">

      {children}

    </label>

  );

}


// ============================================================
// 11. MONEY INPUT
// ============================================================

function MoneyInput({
  value,
  onChange,
  placeholder,
}) {

  return (

    <div className="relative">


      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">

        ₹

      </span>


      <input
        type="number"
        min="0"
        step="1"
        value={
          value
        }
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        className={`${inputClass} pl-8`}
      />


    </div>

  );

}


// ============================================================
// 12. SHARED TAILWIND CLASSES
// ============================================================

const inputClass =
  "w-full rounded-xl border border-[#dfe6da] bg-white px-3 py-2.5 text-xs text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d]";


const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#18392c] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#244c3b]";


const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe6da] bg-white px-3 py-2 text-[11px] font-semibold text-[#52665b] transition hover:bg-[#f4f7f1]";


// ============================================================
// 13. EXPORT
// ============================================================

export default SavingGoalCard;