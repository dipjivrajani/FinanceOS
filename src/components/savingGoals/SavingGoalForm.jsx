// ============================================================
// FINANCEOS - SAVING GOAL FORM
// ============================================================
//
// Creates a saving goal and records:
// - Target amount
// - Amount already saved
// - Where existing goal funds are held
// - Goal duration
// - Monthly allocation
// - Contribution reminders
//
// IMPORTANT:
//
// FinanceOS records the location of the money.
// It does NOT transfer money to a bank/account.
// ============================================================

import {
  useMemo,
  useState,
} from "react";

import {
  FiX,
  FiTarget,
  FiBell,
  FiCalendar,
  FiAlertTriangle,
  FiCheckCircle,
  FiMapPin,
} from "react-icons/fi";

import useFinance
  from "../../context/useFinance.js";

import {
  calculateMonthlySavings,
  calculateGoalMonthlyRequirement,
  calculateMinimumGoalDuration,
} from "../../utils/financialCalculations.js";


// ============================================================
// FORMAT MONEY
// ============================================================

function formatMoney(amount) {

  return Number(
    amount || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  );

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDateInput(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


// ============================================================
// ADD MONTHS
// ============================================================

function addMonths(
  dateString,
  months
) {

  if (
    !dateString ||
    Number(months) <= 0
  ) {
    return "";
  }


  const [
    year,
    month,
    day,
  ] =
    dateString
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  date.setMonth(
    date.getMonth() +
    Number(months)
  );


  return formatDateInput(
    date
  );

}


// ============================================================
// NEXT CONTRIBUTION DATE
// ============================================================

function calculateNextContributionDate(
  startDate,
  contributionDay
) {

  if (
    !startDate ||
    !contributionDay
  ) {
    return "";
  }


  const [
    year,
    month,
    day,
  ] =
    startDate
      .split("-")
      .map(Number);


  const requestedDay =
    Math.min(
      Math.max(
        Number(contributionDay),
        1
      ),
      28
    );


  let contributionDate =
    new Date(
      year,
      month - 1,
      requestedDay
    );


  const start =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    contributionDate <
    start
  ) {

    contributionDate =
      new Date(
        year,
        month,
        requestedDay
      );

  }


  return formatDateInput(
    contributionDate
  );

}


// ============================================================
// MAIN COMPONENT
// ============================================================

function SavingGoalForm({
  onClose,
  onSuccess,
}) {


  // ==========================================================
  // FINANCE CONTEXT
  // ==========================================================

  const {
    monthlyFinance,
    savingGoals,
    investments,
    insurancePolicies,
    liabilities,
    availableToAllocate,
    showInsufficientFundsModal,
    addSavingGoal,

  } = useFinance();


  // ==========================================================
  // TODAY
  // ==========================================================

  const today =
    formatDateInput(
      new Date()
    );


  // ==========================================================
  // BASIC GOAL STATE
  // ==========================================================

  const [
    goalName,
    setGoalName,
  ] = useState("");


  const [
    targetAmount,
    setTargetAmount,
  ] = useState("");


  const [
    savedAmount,
    setSavedAmount,
  ] = useState("");


  const [
    durationMonths,
    setDurationMonths,
  ] = useState("");


  const [
    startDate,
    setStartDate,
  ] = useState(today);


  // ==========================================================
  // FUND LOCATION
  // ==========================================================

  const [
    fundLocationType,
    setFundLocationType,
  ] = useState("");


  const [
    institution,
    setInstitution,
  ] = useState("");


  const [
    accountLabel,
    setAccountLabel,
  ] = useState("");


  const [
    lastFour,
    setLastFour,
  ] = useState("");


  const [
    initialFundSource,
    setInitialFundSource,
  ] = useState(
    "Existing Savings"
  );


  // ==========================================================
  // REMINDER STATE
  // ==========================================================

  const [
    reminderEnabled,
    setReminderEnabled,
  ] = useState(false);


  const [
    contributionDay,
    setContributionDay,
  ] = useState("5");


  const [
    fiveDaysBefore,
    setFiveDaysBefore,
  ] = useState(false);


  const [
    oneDayBefore,
    setOneDayBefore,
  ] = useState(true);


  const [
    onDueDate,
    setOnDueDate,
  ] = useState(true);


  const [
    inAppNotification,
    setInAppNotification,
  ] = useState(true);


  const [
    emailNotification,
    setEmailNotification,
  ] = useState(true);


  const [
    isSaving,
    setIsSaving,
  ] = useState(false);


  // ==========================================================
  // ERROR
  // ==========================================================

  const [
    error,
    setError,
  ] = useState("");


  // ==========================================================
  // MONTHLY SAVINGS
  // ==========================================================

  const monthlySavings =
    calculateMonthlySavings(

      Number(
        monthlyFinance?.income ||
        0
      ),

      Number(
        monthlyFinance?.expenses ||
        0
      )

    );


  // ==========================================================
  // EXISTING GOAL COMMITMENTS
  // ==========================================================

  const existingGoalCommitments =
    (
      Array.isArray(savingGoals)
        ? savingGoals
        : []
    )
      .filter(
        (goal) =>
          goal.status ===
          "Active"
      )
      .reduce(
        (total, goal) =>
          total +
          Number(
            goal.monthlyContribution ||
            goal.monthlyAllocation ||
            goal.requiredMonthly ||
            0
          ),
        0
      );


  // ==========================================================
  // INVESTMENT COMMITMENTS
  // ==========================================================

  const investmentCommitments =
    (
      Array.isArray(investments)
        ? investments
        : []
    )
      .filter(
        (investment) =>
          investment.status ===
          "Active"
      )
      .reduce(
        (total, investment) =>
          total +
          Number(
            investment.monthlyContribution ||
            investment.monthlyAmount ||
            0
          ),
        0
      );


  // ==========================================================
  // INSURANCE COMMITMENTS
  // ==========================================================

  const insuranceCommitments =
    (
      Array.isArray(
        insurancePolicies
      )
        ? insurancePolicies
        : []
    )
      .filter(
        (policy) =>
          policy.status ===
          "Active"
      )
      .reduce(
        (total, policy) => {

          const oldMonthlyPremium =
            Number(
              policy.monthlyPremium ||
              0
            );


          if (
            oldMonthlyPremium > 0
          ) {

            return (
              total +
              oldMonthlyPremium
            );

          }


          const premium =
            Number(
              policy.premiumAmount ||
              policy.amount ||
              0
            );


          const frequency =
            String(
              policy.premiumFrequency ||
              policy.frequency ||
              "Monthly"
            ).toLowerCase();


          if (
            frequency.includes(
              "quarter"
            )
          ) {

            return (
              total +
              premium / 3
            );

          }


          if (
            frequency.includes(
              "half"
            )
          ) {

            return (
              total +
              premium / 6
            );

          }


          if (
            frequency.includes(
              "year"
            ) ||
            frequency.includes(
              "annual"
            )
          ) {

            return (
              total +
              premium / 12
            );

          }


          return (
            total +
            premium
          );

        },
        0
      );


  // ==========================================================
  // LIABILITY COMMITMENTS
  // ==========================================================

  const liabilityCommitments =
    (
      Array.isArray(
        liabilities
      )
        ? liabilities
        : []
    )
      .filter(
        (liability) =>
          liability.status ===
          "Active"
      )
      .reduce(
        (total, liability) =>
          total +
          Number(
            liability.monthlyPayment ||
            liability.monthlyEMI ||
            liability.monthlyEmi ||
            liability.emi ||
            0
          ),
        0
      );


  // ==========================================================
  // TOTAL COMMITMENTS
  // ==========================================================

  const totalCommitments =

    existingGoalCommitments +

    investmentCommitments +

    insuranceCommitments +

    liabilityCommitments;


  // ==========================================================
  // AVAILABLE TO ALLOCATE
  // ==========================================================

  


  // ==========================================================
  // NUMERIC VALUES
  // ==========================================================

  const target =
    Number(
      targetAmount || 0
    );


  const alreadySaved =
    Number(
      savedAmount || 0
    );


  const duration =
    Number(
      durationMonths || 0
    );


  // ==========================================================
  // REMAINING AMOUNT
  // ==========================================================

  const remainingAmount =
    Math.max(
      target -
      alreadySaved,
      0
    );


  // ==========================================================
  // REQUIRED MONTHLY CONTRIBUTION
  // ==========================================================

  const requiredPerMonth =
    calculateGoalMonthlyRequirement(
      target,
      alreadySaved,
      duration
    );


  // ==========================================================
  // AFFORDABILITY
  // ==========================================================

  const isAffordable =

    requiredPerMonth > 0 &&

    requiredPerMonth <=
      availableToAllocate;


  // ==========================================================
  // MINIMUM DURATION
  // ==========================================================

  const minimumDuration =
    calculateMinimumGoalDuration(
      target,
      alreadySaved,
      availableToAllocate
    );


  // ==========================================================
  // TARGET DATE
  // ==========================================================

  const targetDate =
    useMemo(
      () =>
        addMonths(
          startDate,
          duration
        ),
      [
        startDate,
        duration,
      ]
    );


  // ==========================================================
  // NEXT CONTRIBUTION DATE
  // ==========================================================

  const nextContributionDate =
    useMemo(
      () =>
        calculateNextContributionDate(
          startDate,
          contributionDay
        ),
      [
        startDate,
        contributionDay,
      ]
    );


  // ==========================================================
  // FUND LOCATION LABEL
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
  // SUBMIT
  // ==========================================================

  const handleSubmit = async(event) => {

    event.preventDefault();
     console.log("Step 1: handleSubmit started");
    setError("");


    // ========================================================
    // GOAL NAME
    // ========================================================

    if (
      !goalName.trim()
    ) {

      setError(
        "Enter a goal name."
      );

      return;

    }


    // ========================================================
    // TARGET
    // ========================================================

    if (
      !Number.isFinite(target) ||
      target <= 0
    ) {

      setError(
        "Enter a valid target amount."
      );

      return;

    }


    // ========================================================
    // ALREADY SAVED
    // ========================================================

    if (
      !Number.isFinite(
        alreadySaved
      ) ||
      alreadySaved < 0
    ) {

      setError(
        "Enter a valid amount already saved."
      );

      return;

    }


    if (
      alreadySaved >= target
    ) {

      setError(
        "Already saved amount must be less than the target amount."
      );

      return;

    }


    // ========================================================
    // FUND LOCATION
    // ========================================================
    //
    // We only require a location if the user says money has
    // already been saved.
    // ========================================================

    if (
      alreadySaved > 0 &&
      !fundLocationType
    ) {

      setError(
        "Select where your already saved goal money is currently held."
      );

      return;

    }


    if (
      alreadySaved > 0 &&
      requiresInstitution &&
      !institution.trim()
    ) {

      setError(
        "Enter the bank or institution where your goal funds are held."
      );

      return;

    }


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


    // ========================================================
    // DURATION
    // ========================================================

    if (
      !Number.isInteger(
        duration
      ) ||
      duration <= 0
    ) {

      setError(
        "Enter a valid duration in months."
      );

      return;

    }


    // ========================================================
    // START DATE
    // ========================================================

    if (
      !startDate
    ) {

      setError(
        "Select a goal start date."
      );

      return;

    }


    // ========================================================
    // AFFORDABILITY (ONLY FOR ACTUAL INITIAL CONTRIBUTION)
    // ========================================================

    if (
      alreadySaved > 0 &&
      alreadySaved > availableToAllocate
    ) {
      if (typeof onClose === "function") {
        onClose();
      }
      showInsufficientFundsModal({
        availableAmount: availableToAllocate,
        requestedAmount: alreadySaved,
      });
      return;
    }


    // ========================================================
    // REMINDER VALIDATION
    // ========================================================

    if (
      reminderEnabled
    ) {

      const day =
        Number(
          contributionDay
        );


      if (
        !Number.isInteger(day) ||
        day < 1 ||
        day > 28
      ) {

        setError(
          "Contribution day must be between 1 and 28."
        );

        return;

      }


      if (
        !inAppNotification &&
        !emailNotification
      ) {

        setError(
          "Select at least one notification channel."
        );

        return;

      }

    }


    // ========================================================
    // NOTIFY OPTIONS
    // ========================================================

    const notifyBefore = [];


    if (
      fiveDaysBefore
    ) {

      notifyBefore.push(5);

    }


    if (
      oneDayBefore
    ) {

      notifyBefore.push(1);

    }


    if (
      onDueDate
    ) {

      notifyBefore.push(0);

    }


    // ========================================================
    // CREATE GOAL
    // ========================================================

    try {
      setIsSaving(true);

      const newGoal =
        await addSavingGoal({

          goalName: goalName.trim(),

          // Use the correct category or add a category selector
          category: "Other",

          alreadySaved: alreadySaved,

          targetAmount: target,

          currentAmount: alreadySaved,

          monthlyContribution: requiredPerMonth,

          // Recurring contribution schedule configured once at creation
          contributionDay: Number(contributionDay) || 5,

          contributionFrequency: "Monthly",

          startDate,

          targetDate,

          status: "Active",

          notes: "",

          // ====================================================
          // FUND LOCATION
          // ====================================================

          fundLocation: {

            type:
              alreadySaved > 0
                ? fundLocationType
                : "",

            institution:
              alreadySaved > 0
                ? institution.trim()
                : "",

            label:
              alreadySaved > 0
                ? accountLabel.trim()
                : "",

            lastFour:
              alreadySaved > 0
                ? lastFour
                : "",

          },


          // ====================================================
          // INITIAL CONTRIBUTION
          // ====================================================

          initialContributionDate:
            startDate,

          initialContributionSource:
            initialFundSource,


          // ====================================================
          // REMINDER
          // ====================================================

          reminder: {

            enabled:
              reminderEnabled,

            contributionDay:
              Number(
                contributionDay
              ),

            notifyBefore,

            channels: {

              inApp:
                inAppNotification,

              email:
                emailNotification,

            },

          },

        });


      // ========================================================
      // SUCCESS
      // ========================================================

      if (
        onSuccess
      ) {

        onSuccess(
          newGoal
        );

      }


      if (
        onClose
      ) {

        onClose();

      }

    } catch (err) {
      if (err?.code === "INSUFFICIENT_FUNDS") {
        if (typeof onClose === "function") {
          onClose();
        }
        return;
      }
      console.error("Failed to create saving goal:", err);
      setError(
        err?.message ||
        "Failed to create saving goal. Please try again."
      );
    } finally {
      setIsSaving(false);
    }

  };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">


      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e2e8dc] bg-white shadow-xl">


        {/* ====================================================
            HEADER
           ==================================================== */}

        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#edf0e9] bg-white p-6">


          <div>


            <div className="flex items-center gap-2 text-[#315c46]">

              <FiTarget />

              <p className="text-[10px] font-semibold uppercase tracking-[0.15em]">
                Saving Goal
              </p>

            </div>


            <h2 className="mt-2 text-xl font-bold text-[#18392c]">
              Create Saving Goal
            </h2>


            <p className="mt-1 text-xs text-slate-400">

              Set your target, monthly plan, and record
              where your goal funds are held.

            </p>


          </div>


          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#f4f7f1]"
          >

            <FiX />

          </button>


        </div>


        {/* ====================================================
            FORM
           ==================================================== */}

        <form
          onSubmit={
            handleSubmit
          }
          className="p-6"
        >


          {/* ==================================================
              GOAL DETAILS
             ================================================== */}

          <SectionHeading
            title="Goal Details"
            description="Tell FinanceOS what you are saving for."
          />


          <div className="mt-4">


            <FieldLabel>
              Goal Name
            </FieldLabel>


            <input
              type="text"
              value={
                goalName
              }
              onChange={(event) =>
                setGoalName(
                  event.target.value
                )
              }
              placeholder="Example: Phone, Car, Travel"
              className={inputClass}
            />


          </div>


          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">


            <div>


              <FieldLabel>
                Target Amount
              </FieldLabel>


              <MoneyInput
                value={
                  targetAmount
                }
                onChange={
                  setTargetAmount
                }
                placeholder="50000"
              />


            </div>


            <div>


              <FieldLabel>
                Already Saved
              </FieldLabel>


              <MoneyInput
                value={
                  savedAmount
                }
                onChange={
                  setSavedAmount
                }
                placeholder="10000"
              />


              <p className="mt-1 text-[10px] leading-4 text-slate-400">

                Money you have already set aside
                specifically for this goal.

              </p>


            </div>


          </div>


          {/* REMAINING */}

          {target > 0 && (

            <div className="mt-4 rounded-xl bg-[#fafcf8] p-4">


              <p className="text-[10px] text-slate-400">
                Remaining Amount
              </p>


              <p className="mt-1 text-lg font-bold text-[#18392c]">

                ₹{formatMoney(
                  remainingAmount
                )}

              </p>


            </div>

          )}


          {/* ==================================================
              FUND LOCATION
             ================================================== */}

          {alreadySaved > 0 && (

            <div className="mt-7 border-t border-[#edf0e9] pt-6">


              <div className="flex items-start gap-3">


                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f7f1] text-[#315c46]">

                  <FiMapPin />

                </div>


                <div>

                  <h3 className="text-sm font-semibold text-[#18392c]">
                    Goal Fund Location
                  </h3>

                  <p className="mt-1 text-[10px] leading-4 text-slate-400">

                    Record where the ₹{formatMoney(
                      alreadySaved
                    )} you already saved is currently held.

                  </p>

                </div>


              </div>


              {/* LOCATION TYPE */}

              <div className="mt-5">


                <FieldLabel>
                  Where is this money stored?
                </FieldLabel>


                <select
                  value={
                    fundLocationType
                  }
                  onChange={(event) => {

                    const value =
                      event.target.value;

                    setFundLocationType(
                      value
                    );

                    setInstitution("");

                    setAccountLabel("");

                    setLastFour("");

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


              </div>


              {/* BANK / INSTITUTION */}

              {requiresInstitution && (

                <div className="mt-4">


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
                        : "Example: SBI, HDFC, Post Office"
                    }
                    className={inputClass}
                  />


                </div>

              )}


              {/* ACCOUNT LABEL */}

              {fundLocationType &&
                fundLocationType !==
                  "Cash" && (

                <div className="mt-4">


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
                    placeholder={
                      fundLocationType ===
                      "Bank Account"
                        ? "Example: Savings Account"
                        : "Example: Phone Goal Fund"
                    }
                    className={inputClass}
                  />


                  <p className="mt-1 text-[10px] leading-4 text-slate-400">

                    Use a simple label so you can
                    identify where this goal fund is kept.

                  </p>


                </div>

              )}


              {/* LAST FOUR */}

              {fundLocationType ===
                "Bank Account" && (

                <div className="mt-4">


                  <FieldLabel>
                    Last 4 Account Digits (Optional)
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


                  <p className="mt-1 text-[10px] leading-4 text-slate-400">

                    Do not enter your full bank
                    account number.

                  </p>


                </div>

              )}


              {/* OTHER */}

              {fundLocationType ===
                "Other" && (

                <div className="mt-4">


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


              {/* INITIAL SOURCE */}

              <div className="mt-4">


                <FieldLabel>
                  Initial Fund Source
                </FieldLabel>


                <select
                  value={
                    initialFundSource
                  }
                  onChange={(event) =>
                    setInitialFundSource(
                      event.target.value
                    )
                  }
                  className={inputClass}
                >

                  <option value="Existing Savings">
                    Existing Savings
                  </option>

                  <option value="Monthly Savings">
                    Monthly Savings
                  </option>

                  <option value="Cash Savings">
                    Cash Savings
                  </option>

                  <option value="Previous Income">
                    Previous Income
                  </option>

                  <option value="Gift">
                    Gift
                  </option>

                  <option value="Other">
                    Other
                  </option>

                </select>


              </div>


              {/* INFORMATION */}

              {fundLocationType && (

                <div className="mt-4 rounded-xl border border-[#d7ead0] bg-[#f4faef] p-4">


                  <p className="text-xs font-semibold text-[#315c46]">
                    Fund Tracking
                  </p>


                  <p className="mt-1 text-[10px] leading-5 text-[#5f7568]">

                    FinanceOS will record ₹{formatMoney(
                      alreadySaved
                    )} as the initial contribution to this goal.

                    {" "}

                    The money remains in the location
                    you selected.

                  </p>


                </div>

              )}


            </div>

          )}


          {/* ==================================================
              GOAL PLAN
             ================================================== */}

          <div className="mt-7 border-t border-[#edf0e9] pt-6">


            <SectionHeading
              title="Goal Plan"
              description="Choose when you start and how many months you want to save."
            />


            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">


              <div>


                <FieldLabel>
                  Start Date
                </FieldLabel>


                <input
                  type="date"
                  value={
                    startDate
                  }
                  onChange={(event) =>
                    setStartDate(
                      event.target.value
                    )
                  }
                  className={inputClass}
                />


              </div>


              <div>


                <FieldLabel>
                  Duration
                </FieldLabel>


                <div className="relative">


                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      durationMonths
                    }
                    onChange={(event) =>
                      setDurationMonths(
                        event.target.value
                      )
                    }
                    placeholder="8"
                    className={`${inputClass} pr-20`}
                  />


                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    months
                  </span>


                </div>


              </div>


            </div>


            {targetDate && (

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-4">


                <FiCalendar className="mt-0.5 text-[#315c46]" />


                <div>


                  <p className="text-xs font-semibold text-[#18392c]">
                    Goal Target Date
                  </p>


                  <p className="mt-1 text-xs text-slate-500">
                    {targetDate}
                  </p>


                  <p className="mt-1 text-[10px] leading-4 text-slate-400">

                    Calculated automatically from
                    your start date and duration.

                  </p>


                </div>


              </div>

            )}


          </div>


          {/* ==================================================
              FINANCIAL CHECK
             ================================================== */}

          <div className="mt-7 border-t border-[#edf0e9] pt-6">


            <SectionHeading
              title="Financial Check"
              description="FinanceOS checks this goal against your current monthly capacity."
            />


            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">


              <SummaryBox
                label="Monthly Savings"
                value={`₹${formatMoney(
                  monthlySavings
                )}`}
              />


              <SummaryBox
                label="Existing Commitments"
                value={`₹${formatMoney(
                  totalCommitments
                )}`}
              />


              <SummaryBox
                label="Available"
                value={`₹${formatMoney(
                  availableToAllocate
                )}`}
              />


            </div>


            {requiredPerMonth > 0 && (

              <div
                className={
                  isAffordable
                    ? "mt-4 rounded-xl border border-[#d7ead0] bg-[#f4faef] p-4"
                    : "mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
                }
              >


                <div className="flex items-start gap-3">


                  {isAffordable ? (

                    <FiCheckCircle className="mt-0.5 shrink-0 text-[#315c46]" />

                  ) : (

                    <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600" />

                  )}


                  <div>


                    <p
                      className={
                        isAffordable
                          ? "text-xs font-semibold text-[#315c46]"
                          : "text-xs font-semibold text-amber-700"
                      }
                    >
                      Required Monthly Contribution
                    </p>


                    <p className="mt-1 text-xl font-bold text-[#18392c]">

                      ₹{formatMoney(
                        requiredPerMonth
                      )}

                    </p>


                    {isAffordable ? (

                      <p className="mt-2 text-[10px] leading-4 text-[#5f7568]">

                        This goal fits within your
                        current available monthly amount.

                      </p>

                    ) : (

                      <p className="mt-2 text-[10px] leading-4 text-amber-700">

                        Your current available amount is
                        ₹{formatMoney(
                          availableToAllocate
                        )} per month.

                        {minimumDuration
                          ? ` A duration of at least ${minimumDuration} months would better fit your current capacity.`
                          : " You currently do not have available monthly capacity for this goal."}

                      </p>

                    )}


                  </div>


                </div>


              </div>

            )}


          </div>


          {/* ==================================================
              REMINDER
             ================================================== */}

          <div className="mt-7 border-t border-[#edf0e9] pt-6">


            <div className="flex items-start justify-between gap-5">


              <div>


                <div className="flex items-center gap-2">


                  <FiBell className="text-[#315c46]" />


                  <h3 className="text-sm font-semibold text-[#18392c]">
                    Contribution Reminder
                  </h3>


                </div>


                <p className="mt-1 text-[10px] leading-4 text-slate-400">

                  Remind me about my planned monthly
                  contribution.

                </p>


              </div>


              <button
                type="button"
                onClick={() =>
                  setReminderEnabled(
                    !reminderEnabled
                  )
                }
                className={
                  reminderEnabled
                    ? "relative h-6 w-11 rounded-full bg-[#315c46] transition"
                    : "relative h-6 w-11 rounded-full bg-slate-200 transition"
                }
              >


                <span
                  className={
                    reminderEnabled
                      ? "absolute right-1 top-1 h-4 w-4 rounded-full bg-white transition"
                      : "absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition"
                  }
                />


              </button>


            </div>


            {reminderEnabled && (

              <div className="mt-5 rounded-xl border border-[#e2e8dc] bg-[#fafcf8] p-4">


                <div>


                  <FieldLabel>
                    Monthly Contribution Day
                  </FieldLabel>


                  <select
                    value={
                      contributionDay
                    }
                    onChange={(event) =>
                      setContributionDay(
                        event.target.value
                      )
                    }
                    className={inputClass}
                  >

                    {Array.from(
                      {
                        length: 28,
                      },
                      (_, index) =>
                        index + 1
                    ).map(
                      (day) => (

                        <option
                          key={day}
                          value={day}
                        >
                          Day {day}
                        </option>

                      )
                    )}

                  </select>


                </div>


                {nextContributionDate && (

                  <div className="mt-4 rounded-lg bg-white p-3">


                    <p className="text-[10px] text-slate-400">
                      Next Contribution
                    </p>


                    <p className="mt-1 text-xs font-semibold text-[#18392c]">
                      {nextContributionDate}
                    </p>


                  </div>

                )}


                <div className="mt-5">


                  <FieldLabel>
                    Notify Me
                  </FieldLabel>


                  <div className="mt-2 space-y-2">


                    <CheckOption
                      label="5 days before"
                      checked={
                        fiveDaysBefore
                      }
                      onChange={
                        setFiveDaysBefore
                      }
                    />


                    <CheckOption
                      label="1 day before"
                      checked={
                        oneDayBefore
                      }
                      onChange={
                        setOneDayBefore
                      }
                    />


                    <CheckOption
                      label="On contribution date"
                      checked={
                        onDueDate
                      }
                      onChange={
                        setOnDueDate
                      }
                    />


                  </div>


                </div>


                <div className="mt-5">


                  <FieldLabel>
                    Notification Channels
                  </FieldLabel>


                  <div className="mt-3 flex flex-col gap-3">

                    <CheckOption
                      label="In-App Notification"
                      checked={
                        inAppNotification
                      }
                      disabled={
                        isSaving
                      }
                      onChange={
                        setInAppNotification
                      }
                    />

                    <CheckOption
                      label="Email Notification"
                      checked={
                        emailNotification
                      }
                      disabled={
                        isSaving
                      }
                      onChange={
                        setEmailNotification
                      }
                    />

                  </div>


                </div>


              </div>

            )}


          </div>


          {/* ==================================================
              ERROR
             ================================================== */}

          {error && (

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

              <p className="text-xs leading-5 text-red-600">
                {error}
              </p>

            </div>

          )}


          {/* ==================================================
              BUTTONS
             ================================================== */}

          <div className="mt-7 flex justify-end gap-3 border-t border-[#edf0e9] pt-5">


            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                isSaving
              }
              className="rounded-xl border border-[#dfe6da] px-5 py-2.5 text-xs font-semibold text-[#52665b] transition hover:bg-[#f4f7f1] disabled:opacity-50"
            >
              Cancel
            </button>


            <button
              type="submit"
              disabled={
                isSaving
              }
              className="rounded-xl bg-[#18392c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#244c3b] disabled:opacity-50"
            >
              {isSaving ? "Creating Goal..." : "Create Goal"}
            </button>


          </div>


        </form>


      </div>


    </div>

  );

}


// ============================================================
// SECTION HEADING
// ============================================================

function SectionHeading({
  title,
  description,
}) {

  return (

    <div>

      <h3 className="text-sm font-semibold text-[#18392c]">
        {title}
      </h3>

      <p className="mt-1 text-[10px] leading-4 text-slate-400">
        {description}
      </p>

    </div>

  );

}


// ============================================================
// FIELD LABEL
// ============================================================

function FieldLabel({
  children,
}) {

  return (

    <label className="mb-2 block text-xs font-semibold text-[#52665b]">
      {children}
    </label>

  );

}


// ============================================================
// MONEY INPUT
// ============================================================

function MoneyInput({
  value,
  onChange,
  placeholder,
}) {

  return (

    <div className="relative">


      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        ₹
      </span>


      <input
        type="number"
        min="0"
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
        className={`${inputClass} pl-9`}
      />


    </div>

  );

}


// ============================================================
// SUMMARY BOX
// ============================================================

function SummaryBox({
  label,
  value,
}) {

  return (

    <div className="rounded-xl bg-[#fafcf8] p-4">

      <p className="text-[10px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-[#18392c]">
        {value}
      </p>

    </div>

  );

}


// ============================================================
// CHECK OPTION
// ============================================================

function CheckOption({
  label,
  checked,
  onChange,
  disabled = false,
}) {

  return (

    <label className={`flex items-center gap-2 text-xs text-[#52665b] ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>


      <input
        type="checkbox"
        checked={
          checked
        }
        disabled={
          disabled
        }
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="h-4 w-4 accent-[#315c46] disabled:opacity-50"
      />


      {label}


    </label>

  );

}


// ============================================================
// INPUT CLASS
// ============================================================

const inputClass =
  "mt-2 w-full rounded-xl border border-[#dfe6da] bg-[#fafcf8] px-4 py-3 text-sm text-[#18392c] outline-none transition placeholder:text-slate-300 focus:border-[#9fbd8d]";


// ============================================================
// EXPORT
// ============================================================

export default SavingGoalForm;