// ============================================================
// FINANCEOS - FINANCIAL SUGGESTIONS
// PART 1 OF 2
// ============================================================
//
// Smart financial guidance + lifecycle actions.
//
// Completed Goal:
// - Use Goal Money
// - Keep Saved
//
// Matured Investment:
// - Choose Action
//      -> Add to Cash & Savings
//      -> Allocate to Saving Goal
//      -> Reinvest
//
// Matured Insurance:
// - Choose Action
//      -> Add to Cash & Savings
//      -> Allocate to Saving Goal
//
// Completed Liability:
// - Mark Closed
//
// ============================================================

import {
  useState,
} from "react";


import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDollarSign,
  FiTarget,
  FiTrendingUp,
  FiInfo,
  FiArchive,
  FiSliders,
  FiZap,
  FiX,
  FiRefreshCw,
  FiShield,
  FiClock,
  FiExternalLink,
  FiCheck,
  FiPercent,
  FiActivity,
} from "react-icons/fi";


import useFinance
  from "../../context/useFinance.js";
import CenteredModal from "../common/CenteredModal.jsx";


import MaturityActionModal
  from "./MaturityActionModal.jsx";
import AISuggestionDetailsModalComponent from "./AISuggestionDetailsModal.jsx";


// ============================================================
// SAFE NUMBER
// ============================================================

function safeNumber(value) {

  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : 0;
}


// ============================================================
// FORMAT MONEY
// ============================================================

function formatMoney(value) {
  return safeNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
}


// ============================================================
// NORMALIZE STATUS
// ============================================================

function normalizeStatus(status) {

  return String(status || "")
    .trim()
    .toLowerCase();
}


// ============================================================
// FINANCIAL SUGGESTIONS
// ============================================================

function FinancialSuggestions() {


  // ==========================================================
  // FINANCE CONTEXT
  // ==========================================================

  const finance =
    useFinance();

  const latestAISuggestion =
    finance?.latestAISuggestion;

  // ==========================================================
  // AI SUGGESTION MODAL STATE
  // ==========================================================

  const [
    isAISuggestionModalOpen,
    setIsAISuggestionModalOpen,
  ] = useState(false);

  const handleRefreshAISuggestion = async () => {
    try {
      const res = await finance?.generateAISuggestion({
        context: "dashboard_advisor",
      });
      if (res) {
        setIsAISuggestionModalOpen(true);
      }
    } catch (err) {
      console.error("Dashboard AI generation error:", err);
    }
  };

  // ==========================================================
  // MATURITY MODAL STATE
  // ==========================================================

  const [
    maturityModal,
    setMaturityModal,
  ] = useState({

    isOpen: false,

    item: null,

    itemType: null,

  });

  const [actionModal, setActionModal] = useState(null);

  const showErrorModal = (title, message) => {
    setActionModal({
      isOpen: true,
      type: "error",
      title: title || "Something went wrong",
      message: message || "An unexpected error occurred.",
      confirmText: "OK",
      onConfirm: () => setActionModal(null),
    });
  };

  const showSuccessModal = (title, message) => {
    setActionModal({
      isOpen: true,
      type: "success",
      title: title || "Success",
      message: message || "Operation completed successfully.",
      confirmText: "OK",
      onConfirm: () => setActionModal(null),
    });
  };

  const showInfoModal = (title, message) => {
    setActionModal({
      isOpen: true,
      type: "info",
      title: title || "Information",
      message: message || "",
      confirmText: "OK",
      onConfirm: () => setActionModal(null),
    });
  };

  const showConfirmModal = (title, message, onConfirm, confirmText = "Confirm") => {
    setActionModal({
      isOpen: true,
      type: "warning",
      title,
      message,
      confirmText,
      cancelText: "Cancel",
      onConfirm: () => {
        setActionModal(null);
        onConfirm();
      },
      onCancel: () => setActionModal(null),
    });
  };


  // ==========================================================
  // MONTHLY FINANCE
  // ==========================================================

  const monthlyFinance =
    finance?.monthlyFinance || {};


  const income =
    safeNumber(
      monthlyFinance?.income
    );


  const expenses =
    safeNumber(
      monthlyFinance?.expenses
    );


  // ==========================================================
  // COMMITMENTS
  // ==========================================================

  const goalCommitment =
    safeNumber(
      finance?.goalMonthlyCommitment
    );


  const investmentCommitment =
    safeNumber(
      finance?.investmentMonthlyCommitment
    );


  const insuranceCommitment =
    safeNumber(
      finance?.insuranceMonthlyCommitment
    );


  const liabilityCommitment =
    safeNumber(
      finance?.liabilityMonthlyCommitment
    );


  const totalCommitments =
    goalCommitment +
    investmentCommitment +
    insuranceCommitment +
    liabilityCommitment;


  // ==========================================================
  // MONTHLY SAVINGS
  // ==========================================================

  const monthlySavings =
    income -
    expenses;


  // ==========================================================
  // REMAINING AFTER ALL COMMITMENTS
  // ==========================================================

  const remainingBalance =
    monthlySavings -
    totalCommitments;


  // ==========================================================
  // ARRAYS
  // ==========================================================

  const savingGoals =
    Array.isArray(
      finance?.savingGoals
    )
      ? finance.savingGoals
      : [];


  const investments =
    Array.isArray(
      finance?.investments
    )
      ? finance.investments
      : [];


  const insurancePolicies =
    Array.isArray(
      finance?.insurancePolicies
    )
      ? finance.insurancePolicies
      : [];


  const liabilities =
    Array.isArray(
      finance?.liabilities
    )
      ? finance.liabilities
      : [];


  // ==========================================================
  // CONTEXT ACTION FUNCTIONS
  // ==========================================================

  const settleSavingGoal =
    finance?.settleSavingGoal;


  const withdrawGoalFunds =
    finance?.withdrawGoalFunds;


  const settleInvestment =
    finance?.settleInvestment;


  const allocateMaturedInvestmentToGoal =
    finance?.allocateMaturedInvestmentToGoal;


  const reinvestMaturedInvestment =
    finance?.reinvestMaturedInvestment;


  const settleInsurance =
    finance?.settleInsurance;


  const allocateMaturedInsuranceToGoal =
    finance?.allocateMaturedInsuranceToGoal;


  const closeLiability =
    finance?.closeLiability;


  // ==========================================================
  // OPEN MATURITY MODAL
  // ==========================================================

  function openMaturityModal(
    item,
    itemType
  ) {

    if (!item) {
      return;
    }


    setMaturityModal({

      isOpen: true,

      item,

      itemType,

    });

  }


  // ==========================================================
  // CLOSE MATURITY MODAL
  // ==========================================================

  function closeMaturityModal() {

    setMaturityModal({

      isOpen: false,

      item: null,

      itemType: null,

    });

  }


  // ==========================================================
  // ADD MATURITY PROCEEDS TO SAVINGS
  // ==========================================================

  function handleAddMaturityToSavings(
    item
  ) {

    if (!item) {
      return;
    }


    // --------------------------------------------------------
    // INVESTMENT
    // --------------------------------------------------------

    if (
      maturityModal.itemType ===
      "investment"
    ) {

      if (
        typeof settleInvestment !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Investment settlement is not available."
        );

        return;
      }


      const amount =
        safeNumber(

          item.maturityAmount ??

          item.currentValue ??

          item.amount

        );


      showConfirmModal(
        "Confirm Settlement",
        `Add ₹${formatMoney(
          amount
        )} from this matured investment to Cash & Savings?`,
        () => {
          const result =
            settleInvestment(
              item.id,
              "savings"
            );

          if (
            result?.success === false
          ) {
            showErrorModal(
              "Settlement Failed",
              result.message ||
              "Unable to settle the investment."
            );
            return;
          }

          closeMaturityModal();
        }
      );

      return;
    }


    // --------------------------------------------------------
    // INSURANCE
    // --------------------------------------------------------

    if (
      maturityModal.itemType ===
      "insurance"
    ) {

      if (
        typeof settleInsurance !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Insurance settlement is not available."
        );

        return;
      }


      const amount =
        safeNumber(
          item.maturityAmount
        );


      showConfirmModal(
        "Confirm Settlement",
        `Add ₹${formatMoney(
          amount
        )} from this matured policy to Cash & Savings?`,
        () => {
          const result =
            settleInsurance(
              item.id,
              "savings"
            );

          if (
            result?.success === false
          ) {
            showErrorModal(
              "Settlement Failed",
              result.message ||
              "Unable to settle the insurance policy."
            );
            return;
          }

          closeMaturityModal();
        }
      );

      return;
    }

  }


  // ==========================================================
  // ALLOCATE MATURITY PROCEEDS TO SAVING GOAL
  // ==========================================================

  function handleAllocateMaturityToGoal(
    item,
    goal
  ) {

    if (
      !item ||
      !goal
    ) {
      return;
    }


    // --------------------------------------------------------
    // INVESTMENT -> GOAL
    // --------------------------------------------------------

    if (
      maturityModal.itemType ===
      "investment"
    ) {

      if (
        typeof allocateMaturedInvestmentToGoal !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Investment goal allocation is not available."
        );

        return;
      }


      showConfirmModal(
        "Confirm Allocation",
        `Allocate the matured proceeds from "${item.name || item.type || "Investment"}" toward "${goal.name || "Saving Goal"}"?`,
        () => {
          const result =
            allocateMaturedInvestmentToGoal(
              item.id,
              goal.id
            );

          if (
            result?.success === false
          ) {
            showErrorModal(
              "Allocation Failed",
              result.message ||
              "Unable to allocate the matured investment."
            );
            return;
          }

          if (result?.message) {
            showSuccessModal(
              "Allocation Successful",
              result.message
            );
          }

          closeMaturityModal();
        }
      );

      return;
    }


    // --------------------------------------------------------
    // INSURANCE -> GOAL
    // --------------------------------------------------------

    if (
      maturityModal.itemType ===
      "insurance"
    ) {

      if (
        typeof allocateMaturedInsuranceToGoal !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Insurance goal allocation is not available."
        );

        return;
      }


      showConfirmModal(
        "Confirm Allocation",
        `Allocate the maturity proceeds from "${item.name || item.type || "Insurance Policy"}" toward "${goal.name || "Saving Goal"}"?`,
        () => {
          const result =
            allocateMaturedInsuranceToGoal(
              item.id,
              goal.id
            );

          if (
            result?.success === false
          ) {
            showErrorModal(
              "Allocation Failed",
              result.message ||
              "Unable to allocate the insurance maturity proceeds."
            );
            return;
          }

          if (result?.message) {
            showSuccessModal(
              "Allocation Successful",
              result.message
            );
          }

          closeMaturityModal();
        }
      );

      return;
    }

  }


  // ==========================================================
  // REINVEST MATURITY PROCEEDS
  // ==========================================================

  function handleReinvestMaturity(
    item
  ) {

    if (!item) {
      return;
    }


    if (
      maturityModal.itemType !==
      "investment"
    ) {

      return;
    }


    if (
      typeof reinvestMaturedInvestment !==
      "function"
    ) {

      showErrorModal(
        "Unavailable",
        "Investment reinvestment is not available."
      );

      return;
    }


    const maturityAmount =
      safeNumber(

        item.maturityAmount ??

        item.currentValue ??

        item.amount

      );


    showConfirmModal(
      "Confirm Reinvestment",
      `Reinvest ₹${formatMoney(
        maturityAmount
      )} from "${item.name || item.type || "Investment"}"?`,
      () => {
        const result =
          reinvestMaturedInvestment(
            item.id,
            {

              name:
                `${item.name || item.type || "Investment"} - Reinvested`,

              type:
                item.type ||
                "Investment",

              monthlyContribution:
                0,

            }
          );

        if (
          result?.success === false
        ) {
          showErrorModal(
            "Reinvestment Failed",
            result.message ||
            "Unable to reinvest the maturity proceeds."
          );
          return;
        }

        if (result?.message) {
          showSuccessModal(
            "Reinvestment Successful",
            result.message
          );
        }

        closeMaturityModal();
      }
    );

  }


  // ==========================================================
  // NORMAL SUGGESTION ACTION HANDLER
  // ==========================================================

  function handleAction(
    suggestion,
    action
  ) {

    // ========================================================
    // AI SUGGESTION ACTIONS
    // ========================================================

    if (action === "refresh-ai-suggestion") {
      handleRefreshAISuggestion();
      return;
    }

    if (
      suggestion?.isAI ||
      action === "view-ai-suggestion"
    ) {
      setIsAISuggestionModalOpen(true);
      return;
    }

    // ========================================================
    // COMPLETED SAVING GOAL - KEEP SAVED
    // ========================================================

    if (
      suggestion.category ===
        "goal" &&
      action ===
        "keep-saved"
    ) {

      if (
        typeof settleSavingGoal !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Goal settlement is not available."
        );

        return;
      }


      const result =
        settleSavingGoal(
          suggestion.itemId
        );


      if (
        result?.success === false
      ) {

        showErrorModal(
          "Settlement Failed",
          result.message ||
          "Unable to settle this goal."
        );

      }


      return;
    }


    // ========================================================
    // COMPLETED SAVING GOAL - USE MONEY
    // ========================================================

    if (
      suggestion.category ===
        "goal" &&
      action ===
        "use-money"
    ) {

      if (
        typeof withdrawGoalFunds !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Goal withdrawal is not available."
        );

        return;
      }


      const goal =
        savingGoals.find(
          (item) =>
            item.id ===
            suggestion.itemId
        );


      if (!goal) {

        showErrorModal(
          "Not Found",
          "Saving goal not found."
        );

        return;
      }


      const availableFund =
        Math.max(
          safeNumber(

            goal.availableGoalFund ??

            (
              safeNumber(
                goal.totalContributed ??
                goal.savedAmount
              ) -

              safeNumber(
                goal.totalWithdrawn
              )
            )

          ),
          0
        );


      if (
        availableFund <= 0
      ) {

        showInfoModal(
          "No Funds Available",
          "No goal funds are available to use."
        );

        return;
      }


      showConfirmModal(
        "Confirm Goal Withdrawal",
        `Use ₹${formatMoney(
          availableFund
        )} from "${goal.name || "Saving Goal"}"?`,
        () => {
          const result =
            withdrawGoalFunds(
              suggestion.itemId,
              {

                amount:
                  availableFund,

                purpose:
                  goal.name ||
                  "Goal completed",

                note:
                  "Goal money used after completion.",

                date:
                  new Date()
                    .toISOString()
                    .slice(0, 10),

              }
            );

          if (
            result?.success === false
          ) {
            showErrorModal(
              "Withdrawal Failed",
              result.message ||
              "Unable to use the goal money."
            );
          }
        }
      );

      return;
    }


    // ========================================================
    // MATURED INVESTMENT - OPEN MODAL
    // ========================================================

    if (
      suggestion.category ===
        "investment" &&
      action ===
        "choose-action"
    ) {

      const investment =
        investments.find(
          (item) =>
            item.id ===
            suggestion.itemId
        );


      if (!investment) {

        showErrorModal(
          "Not Found",
          "Investment not found."
        );

        return;
      }


      openMaturityModal(
        investment,
        "investment"
      );


      return;
    }


    // ========================================================
    // MATURED INSURANCE - OPEN MODAL
    // ========================================================

    if (
      suggestion.category ===
        "insurance" &&
      action ===
        "choose-action"
    ) {

      const policy =
        insurancePolicies.find(
          (item) =>
            item.id ===
            suggestion.itemId
        );


      if (!policy) {

        showErrorModal(
          "Not Found",
          "Insurance policy not found."
        );

        return;
      }


      openMaturityModal(
        policy,
        "insurance"
      );


      return;
    }


    // ========================================================
    // COMPLETED LIABILITY
    // ========================================================

    if (
      suggestion.category ===
        "liability" &&
      action ===
        "close"
    ) {

      if (
        typeof closeLiability !==
        "function"
      ) {

        showErrorModal(
          "Unavailable",
          "Liability closing is not available."
        );

        return;
      }


      const result =
        closeLiability(
          suggestion.itemId
        );


      if (
        result?.success === false
      ) {

        showErrorModal(
          "Close Failed",
          result.message ||
          "Unable to close this liability."
        );

      }


      return;
    }

  }


  // ==========================================================
  // SUGGESTIONS
  // ==========================================================

  const suggestions = [];

  // ==========================================================
  // 0. PERSISTED AI SUGGESTION (FROM MONGODB)
  // ==========================================================

  if (latestAISuggestion) {
    const analysisDateStr = new Date(latestAISuggestion.createdAt || Date.now()).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const situationSnippet = latestAISuggestion.yourSituation?.text || latestAISuggestion.summary || "";

    suggestions.push({
      id: `ai-suggestion-${latestAISuggestion._id || latestAISuggestion.id || "latest"}`,
      isAI: true,
      type: "success",
      icon: FiZap,
      title: latestAISuggestion.title || "Personal AI Financial Guide",
      description: `${situationSnippet} • Updated: ${analysisDateStr}`,
      category: "ai",
      priority: 200,
      actions: [
        {
          id: "view-ai-suggestion",
          label: "See Details & Options",
          primary: true,
        },
        {
          id: "refresh-ai-suggestion",
          label: finance?.aiLoading ? "Analyzing..." : "Re-analyze",
          primary: false,
        },
      ],
      rawAI: latestAISuggestion,
    });
  } else {
    suggestions.push({
      id: "ai-suggestion-invite",
      isAI: true,
      type: "money",
      icon: FiZap,
      title: "Personal AI Financial Guide",
      description: "Get personalized, everyday English guidance on what to do with your available funds, emergency cushion, and investments.",
      category: "ai",
      priority: 200,
      actions: [
        {
          id: "refresh-ai-suggestion",
          label: finance?.aiLoading ? "Analyzing..." : "Generate Analysis",
          primary: true,
        },
      ],
    });
  }


  // ==========================================================
  // 1. NO MONTHLY FINANCE DATA
  // ==========================================================

  if (
    income === 0 &&
    expenses === 0
  ) {

    suggestions.push({

      id:
        "setup-monthly-finance",

      type:
        "info",

      icon:
        FiInfo,

      title:
        "Set up your monthly finances",

      description:
        "Add your monthly income and expenses so FinanceOS can calculate your savings, commitments and available balance.",

      priority:
        100,

    });

  }


  // ==========================================================
  // 2. NEGATIVE MONTHLY SAVINGS
  // ==========================================================

  if (
    income > 0 &&
    monthlySavings < 0
  ) {

    suggestions.push({

      id:
        "negative-savings",

      type:
        "danger",

      icon:
        FiAlertTriangle,

      title:
        "Your expenses are higher than your income",

      description:
        `Your monthly expenses exceed your income by ₹${formatMoney(
          Math.abs(
            monthlySavings
          )
        )}. Review expenses before adding new financial commitments.`,

      priority:
        95,

    });

  }


  // ==========================================================
  // 3. COMMITMENTS EXCEED SAVINGS
  // ==========================================================

  if (
    income > 0 &&
    monthlySavings >= 0 &&
    remainingBalance < 0
  ) {

    suggestions.push({

      id:
        "commitment-overload",

      type:
        "danger",

      icon:
        FiAlertTriangle,

      title:
        "Your monthly commitments are too high",

      description:
        `Your current commitments exceed your available monthly savings by ₹${formatMoney(
          Math.abs(
            remainingBalance
          )
        )}. Consider reducing or pausing flexible commitments.`,

      priority:
        90,

    });

  }


  // ==========================================================
  // 4. SMALL POSITIVE BALANCE
  // ==========================================================

  if (
    income > 0 &&
    remainingBalance > 0 &&
    remainingBalance <= 5000
  ) {

    suggestions.push({

      id:
        "small-surplus",

      type:
        "money",

      icon:
        FiDollarSign,

      title:
        `₹${formatMoney(
          remainingBalance
        )} remains this month`,

      description:
        "Your expenses and planned commitments are covered. Consider keeping this amount available as additional cash reserve, or allocate part of it toward an active goal.",

      priority:
        70,

    });

  }


  // ==========================================================
  // 5. HEALTHY POSITIVE BALANCE
  // ==========================================================

  if (
    income > 0 &&
    remainingBalance > 5000
  ) {

    suggestions.push({

      id:
        "healthy-surplus",

      type:
        "success",

      icon:
        FiTrendingUp,

      title:
        `You have ₹${formatMoney(
          remainingBalance
        )} available`,

      description:
        "Your planned monthly expenses and commitments are covered. You may keep part as additional savings and consider allocating the rest toward an active goal or investment.",

      priority:
        65,

    });

  }


  // ==========================================================
  // 6. ACTIVE GOAL NEAR COMPLETION
  // ==========================================================

  savingGoals.forEach(
    (goal, index) => {

      const status =
        normalizeStatus(
          goal?.status
        );


      if (
        status === "completed" ||
        status === "settled" ||
        status === "closed"
      ) {

        return;

      }


      const targetAmount =
        safeNumber(
          goal?.targetAmount
        );


      const savedAmount =
        safeNumber(

          goal?.totalContributed ??

          goal?.savedAmount ??

          goal?.alreadySaved

        );


      if (
        targetAmount <= 0 ||
        savedAmount <= 0
      ) {

        return;

      }


      const progress =
        (
          savedAmount /
          targetAmount
        ) * 100;


      if (
        progress >= 80 &&
        progress < 100
      ) {

        const remaining =
          Math.max(
            targetAmount -
            savedAmount,
            0
          );


        suggestions.push({

          id:
            `goal-near-${goal?.id ?? index}`,

          type:
            "goal",

          icon:
            FiTarget,

          title:
            `${goal?.name || "Saving goal"} is almost complete`,

          description:
            `You have reached ${Math.min(
              progress,
              100
            ).toFixed(
              0
            )}% of this goal. ₹${formatMoney(
              remaining
            )} remains to reach the target.`,

          priority:
            75,

        });

      }

    }
  );


  // ==========================================================
  // PART 2 CONTINUES DIRECTLY BELOW THIS LINE
  // ==========================================================
    // ==========================================================
  // 7. COMPLETED SAVING GOALS
  // ==========================================================

  savingGoals.forEach(
    (goal, index) => {

      const status =
        normalizeStatus(
          goal?.status
        );


      if (
        status !== "completed"
      ) {
        return;
      }


      const totalContributed =
        safeNumber(

          goal?.totalContributed ??

          goal?.savedAmount ??

          0

        );


      const totalWithdrawn =
        safeNumber(
          goal?.totalWithdrawn
        );


      const availableFund =
        Math.max(
          safeNumber(
            goal?.availableGoalFund ??
            (
              totalContributed -
              totalWithdrawn
            )
          ),
          0
        );


      suggestions.push({

        id:
          `completed-goal-${goal?.id ?? index}`,

        category:
          "goal",

        itemId:
          goal?.id,

        type:
          "success",

        icon:
          FiCheckCircle,

        title:
          `${goal?.name || "Saving goal"} is complete`,

        description:
          availableFund > 0

            ? `You have ₹${formatMoney(
                availableFund
              )} available for this completed goal. You can use the money for the goal or keep it saved.`

            : "This saving goal has reached its target.",

        priority:
          88,

        actions:
          availableFund > 0

            ? [

                {
                  id:
                    "use-money",

                  label:
                    "Use Goal Money",

                  primary:
                    true,
                },

                {
                  id:
                    "keep-saved",

                  label:
                    "Keep Saved",

                  primary:
                    false,
                },

              ]

            : [

                {
                  id:
                    "keep-saved",

                  label:
                    "Keep Saved",

                  primary:
                    true,
                },

              ],

      });

    }
  );


  // ==========================================================
  // 8. MATURED INVESTMENTS
  // ==========================================================

  investments.forEach(
    (investment, index) => {

      const status =
        normalizeStatus(
          investment?.status
        );


      if (
        status !== "matured"
      ) {
        return;
      }


      const maturityAmount =
        safeNumber(

          investment?.maturityAmount ??

          investment?.currentValue ??

          investment?.amount ??

          0

        );


      suggestions.push({

        id:
          `matured-investment-${investment?.id ?? index}`,

        category:
          "investment",

        itemId:
          investment?.id,

        type:
          "money",

        icon:
          FiTrendingUp,

        title:
          `${investment?.name || investment?.type || "Investment"} has matured`,

        description:
          maturityAmount > 0

            ? `₹${formatMoney(
                maturityAmount
              )} is now available. Choose whether to move it to Cash & Savings, allocate it to an active saving goal, or reinvest it.`

            : "This investment has matured. Choose what you want to do with the maturity proceeds.",

        priority:
          92,

        actions: [

          {
            id:
              "choose-action",

            label:
              "Choose Action",

            primary:
              true,
          },

        ],

      });

    }
  );


  // ==========================================================
  // 9. MATURED INSURANCE POLICIES
  // ==========================================================

  insurancePolicies.forEach(
    (policy, index) => {

      const status =
        normalizeStatus(
          policy?.status
        );


      if (
        status !== "matured"
      ) {
        return;
      }


      const maturityAmount =
        safeNumber(
          policy?.maturityAmount
        );


      suggestions.push({

        id:
          `matured-insurance-${policy?.id ?? index}`,

        category:
          "insurance",

        itemId:
          policy?.id,

        type:
          "money",

        icon:
          FiArchive,

        title:
          `${policy?.name || policy?.policyName || policy?.type || "Insurance policy"} has matured`,

        description:
          maturityAmount > 0

            ? `₹${formatMoney(
                maturityAmount
              )} in maturity proceeds is available. You can move it to Cash & Savings or allocate it toward an active saving goal.`

            : "This insurance policy has matured. Choose where the maturity proceeds should go.",

        priority:
          91,

        actions: [

          {
            id:
              "choose-action",

            label:
              "Choose Action",

            primary:
              true,
          },

        ],

      });

    }
  );


  // ==========================================================
  // 10. COMPLETED LIABILITIES
  // ==========================================================

  liabilities.forEach(
    (liability, index) => {

      const status =
        normalizeStatus(
          liability?.status
        );


      const remainingAmount =
        Math.max(
          safeNumber(
            liability?.remainingAmount
          ),
          0
        );


      // -------------------------------------------------------
      // Show close action when:
      //
      // 1. Status is Completed
      // OR
      // 2. Balance is zero but it has not been closed yet
      // -------------------------------------------------------

      const canClose =
        status !== "closed" &&
        (
          status === "completed" ||
          remainingAmount <= 0
        );


      if (!canClose) {
        return;
      }


      suggestions.push({

        id:
          `completed-liability-${liability?.id ?? index}`,

        category:
          "liability",

        itemId:
          liability?.id,

        type:
          "success",

        icon:
          FiCheckCircle,

        title:
          `${liability?.name || liability?.type || "Liability"} is fully paid`,

        description:
          "The outstanding balance is zero. Close this liability so it no longer appears as an active financial commitment.",

        priority:
          86,

        actions: [

          {
            id:
              "close",

            label:
              "Mark Closed",

            primary:
              true,
          },

        ],

      });

    }
  );


  // ==========================================================
  // 11. HIGH COMMITMENT RATIO
  // ==========================================================

  if (
    income > 0 &&
    totalCommitments > 0
  ) {

    const commitmentRatio =
      (
        totalCommitments /
        income
      ) * 100;


    if (
      commitmentRatio >= 60 &&
      remainingBalance >= 0
    ) {

      suggestions.push({

        id:
          "high-commitment-ratio",

        type:
          "warning",

        icon:
          FiSliders,

        title:
          "A large part of your income is committed",

        description:
          `${commitmentRatio.toFixed(
            0
          )}% of your monthly income is currently assigned to goals, investments, insurance and liabilities. Keep enough unallocated money available for unexpected expenses.`,

        priority:
          68,

      });

    }

  }


  // ==========================================================
  // 12. NO ACTIVE GOALS
  // ==========================================================

  const activeGoals =
    savingGoals.filter(
      (goal) => {

        const status =
          normalizeStatus(
            goal?.status
          );


        const target =
          safeNumber(
            goal?.targetAmount
          );


        const contributed =
          safeNumber(

            goal?.totalContributed ??

            goal?.savedAmount ??

            0

          );


        return (
          status !== "completed" &&
          status !== "settled" &&
          status !== "closed" &&
          status !== "paused" &&
          target > 0 &&
          contributed < target
        );

      }
    );


  if (
    income > 0 &&
    remainingBalance > 0 &&
    activeGoals.length === 0
  ) {

    suggestions.push({

      id:
        "no-active-goals",

      type:
        "info",

      icon:
        FiTarget,

      title:
        "You have room for a saving goal",

      description:
        `After your current expenses and commitments, ₹${formatMoney(
          remainingBalance
        )} remains available. Consider creating a saving goal if you have a planned future purchase or financial target.`,

      priority:
        45,

    });

  }


  // ==========================================================
  // SORT SUGGESTIONS
  // ==========================================================

  suggestions.sort(
    (first, second) =>
      safeNumber(
        second.priority
      ) -
      safeNumber(
        first.priority
      )
  );


  // ==========================================================
  // LIMIT DASHBOARD SUGGESTIONS
  // ==========================================================
  //
  // Lifecycle suggestions are important, so keep more cards
  // available when a matured/completed item requires action.
  //
  // ==========================================================

  // AI ADVISER CARD (GEMINI + MONGODB + LIVE MARKET)
  if (latestAISuggestion) {
    suggestions.unshift({
      id: "ai-personalized-adviser",
      isAI: true,
      category: "ai",
      type: latestAISuggestion.overallHealth === "Needs Attention" ? "danger" : "money",
      icon: FiZap,
      title: latestAISuggestion.title,
      description: latestAISuggestion.summary,
      priority: 200,
      actions: [
        {
          id: "view-ai-suggestion",
          label: "View Full AI Analysis",
          primary: true,
        },
        {
          id: "refresh-ai-suggestion",
          label: finance?.aiLoading ? "Analyzing..." : "Re-analyze",
          primary: false,
        },
      ],
    });
  } else {
    suggestions.unshift({
      id: "ai-personalized-adviser-prompt",
      isAI: true,
      category: "ai",
      type: "money",
      icon: FiZap,
      title: "Personalized AI Financial Adviser",
      description: "Analyze your verified MongoDB income, debt, and savings against live Indian market data using Google Gemini.",
      priority: 190,
      actions: [
        {
          id: "refresh-ai-suggestion",
          label: finance?.aiLoading ? "Analyzing..." : "Get AI Suggestion",
          primary: true,
        },
      ],
    });
  }

  const aiSuggestions =
    suggestions.filter(
      (s) => s.isAI
    );

  const lifecycleSuggestions =
    suggestions.filter(
      (suggestion) =>
        suggestion.category === "goal" ||
        suggestion.category === "investment" ||
        suggestion.category === "insurance" ||
        suggestion.category === "liability"
    );


  const generalSuggestions =
    suggestions.filter(
      (suggestion) =>
        !suggestion.category && !suggestion.isAI
    );


  const visibleSuggestions = [
    ...aiSuggestions,
    ...lifecycleSuggestions,
    ...generalSuggestions,
  ].slice(
    0,
    6
  );


  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  if (
    visibleSuggestions.length === 0
  ) {

    visibleSuggestions.push({

      id:
        "financial-position-ok",

      type:
        "success",

      icon:
        FiCheckCircle,

      title:
        "Your current financial plan looks balanced",

      description:
        "FinanceOS does not detect any immediate action from your current monthly finance, goals, investments, insurance or liabilities.",

      priority:
        1,

    });

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <>

      <section
        className="
          rounded-2xl
          border
          border-[#e2e8dc]
          bg-white
          p-5
        "
      >


        {/* ====================================================
            HEADER
           ==================================================== */}

        <div
          className="
            flex
            items-start
            justify-between
            gap-4
          "
        >


          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.14em]
                  text-[#6c8b72]
                "
              >
                Smart Guidance
              </p>
              {latestAISuggestion && (
                <span className="rounded-full bg-[#f0f5ee] px-2 py-0.5 text-[9px] font-semibold text-[#315c46]">
                  Last analyzed: {new Date(latestAISuggestion.createdAt || Date.now()).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <h2
                className="
                  text-base
                  font-semibold
                  text-[#18392c]
                "
              >
                Financial Suggestions
              </h2>

              <button
                type="button"
                onClick={handleRefreshAISuggestion}
                disabled={finance?.aiLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#315c46] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#18392c] shadow-2xs transition hover:bg-[#edf6e8] disabled:opacity-50 cursor-pointer"
                title="Run fresh AI analysis on current MongoDB and live market data"
              >
                <FiRefreshCw className={`text-xs ${finance?.aiLoading ? "animate-spin text-[#315c46]" : "text-[#315c46]"}`} />
                <span>{finance?.aiLoading ? (finance?.aiLoadingMessage || "Analyzing latest data...") : (latestAISuggestion ? "Refresh AI Suggestion" : "Get AI Suggestion")}</span>
              </button>
            </div>

            <p
              className="
                mt-1
                max-w-2xl
                text-xs
                leading-5
                text-slate-400
              "
            >
              Suggestions are generated fresh from your monthly
              finances, commitments, goals and verified market data.
            </p>

          </div>


          {/* ==================================================
              REMAINING BALANCE
             ================================================== */}

          {

            income > 0 && (

              <div
                className="
                  shrink-0
                  rounded-xl
                  bg-[#f7fbf4]
                  px-4
                  py-3
                  text-right
                "
              >


                <p
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-[#6c8b72]
                  "
                >

                  After Everything

                </p>


                <p
                  className={`
                    mt-1
                    text-sm
                    font-bold

                    ${
                      remainingBalance >= 0

                        ? "text-[#315c46]"

                        : "text-red-600"
                    }
                  `}
                >

                  {
                    remainingBalance < 0
                      ? "-"
                      : ""
                  }

                  ₹{formatMoney(
                    Math.abs(
                      remainingBalance
                    )
                  )}

                </p>


              </div>

            )

          }


        </div>


        {/* ====================================================
            SUGGESTION CARDS
           ==================================================== */}

        <div
          className="
            mt-5
            space-y-3
          "
        >
          {finance?.aiError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 shadow-xs">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="mt-0.5 text-rose-600 shrink-0" size={15} />
                <div>
                  <p className="font-semibold text-rose-900">AI Financial Adviser Notice</p>
                  <p className="mt-0.5 text-rose-700">{finance.aiError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshAISuggestion}
                disabled={finance?.aiLoading}
                className="shrink-0 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}


          {

            visibleSuggestions.map(
              (suggestion) => (

                <SuggestionCard

                  key={
                    suggestion.id
                  }

                  suggestion={
                    suggestion
                  }

                  onAction={
                    handleAction
                  }

                />

              )
            )

          }


        </div>


        {/* ====================================================
            GUIDANCE NOTE
           ==================================================== */}

        <div
          className="
            mt-4
            rounded-xl
            bg-[#f8faf7]
            px-4
            py-3
          "
        >

          <p
            className="
              text-[10px]
              leading-5
              text-[#6c8b72]
            "
          >

            FinanceOS suggestions are guidance based on the
            financial information recorded in your account.
            They do not automatically move money unless you
            select and confirm a lifecycle action.

          </p>

        </div>


      </section>


      {/* ======================================================
          MATURITY ACTION MODAL
         ====================================================== */}

      <MaturityActionModal

        isOpen={
          maturityModal.isOpen
        }

        item={
          maturityModal.item
        }

        itemType={
          maturityModal.itemType ||
          "investment"
        }

        savingGoals={
          savingGoals
        }

        onClose={
          closeMaturityModal
        }

        onAddToSavings={
          handleAddMaturityToSavings
        }

        onAllocateToGoal={
          handleAllocateMaturityToGoal
        }

        onReinvest={
          handleReinvestMaturity
        }

      />

      {/* ======================================================
          AI SUGGESTION DETAILS MODAL
         ====================================================== */}

      <AISuggestionDetailsModal
        isOpen={isAISuggestionModalOpen}
        suggestion={latestAISuggestion}
        onClose={() => setIsAISuggestionModalOpen(false)}
        onRefresh={handleRefreshAISuggestion}
        aiLoading={finance?.aiLoading}
      />

      {/* ======================================================
          ACTION MODAL (CENTERED)
         ====================================================== */}
      {actionModal && <CenteredModal {...actionModal} />}

    </>

  );

}


// ============================================================
// SUGGESTION CARD
// ============================================================

function SuggestionCard({
  suggestion,
  onAction,
}) {


  // ==========================================================
  // ICON
  // ==========================================================

  const Icon =
    suggestion?.icon ||
    FiInfo;


  // ==========================================================
  // TYPE
  // ==========================================================

  const type =
    suggestion?.type ||
    "info";


  // ==========================================================
  // STYLE
  // ==========================================================

  const styles = {

    danger: {
      wrapper:
        "border-red-100 bg-red-50/50",

      icon:
        "bg-red-100 text-red-600",
    },

    warning: {
      wrapper:
        "border-amber-100 bg-amber-50/40",

      icon:
        "bg-amber-100 text-amber-700",
    },

    success: {
      wrapper:
        "border-[#dcebd4] bg-[#f7fbf4]",

      icon:
        "bg-[#e8f4e2] text-[#315c46]",
    },

    money: {
      wrapper:
        "border-[#dcebd4] bg-white",

      icon:
        "bg-[#edf6e8] text-[#315c46]",
    },

    goal: {
      wrapper:
        "border-[#e2e8dc] bg-white",

      icon:
        "bg-[#f2f6ee] text-[#315c46]",
    },

    info: {
      wrapper:
        "border-[#e2e8dc] bg-[#fafbf9]",

      icon:
        "bg-[#f0f3ed] text-[#5f7568]",
    },

  };


  const selectedStyle =
    styles[type] ||
    styles.info;


  // ==========================================================
  // ACTIONS
  // ==========================================================

  const actions =
    Array.isArray(
      suggestion?.actions
    )
      ? suggestion.actions
      : [];


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div
      className={`
        rounded-xl
        border
        p-4
        ${selectedStyle.wrapper}
      `}
    >


      <div
        className="
          flex
          items-start
          gap-3
        "
      >


        {/* ====================================================
            ICON
           ==================================================== */}

        <div
          className={`
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            ${selectedStyle.icon}
          `}
        >

          <Icon
            size={17}
          />

        </div>


        {/* ====================================================
            CONTENT
           ==================================================== */}

        <div
          className="
            min-w-0
            flex-1
          "
        >

          <div className="flex flex-wrap items-center gap-2">
            <p
              className="
                text-sm
                font-semibold
                text-[#18392c]
              "
            >
              {
                suggestion?.title ||
                "Financial suggestion"
              }
            </p>

            {suggestion?.isAI && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#315c46] px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                <FiZap size={10} />
                AI Suggestion
              </span>
            )}
          </div>


          <p
            className="
              mt-1
              text-xs
              leading-5
              text-slate-500
            "
          >

            {
              suggestion?.description ||
              ""
            }

          </p>

          {suggestion?.isAI && (
            <p className="mt-2 text-[10px] text-amber-800/80 font-medium italic border-t border-[#e2e8dc] pt-1.5">
              Invest at your own risk — market prices and conditions can change, and values may increase or decrease.
            </p>
          )}


          {/* ==================================================
              ACTION BUTTONS
             ================================================== */}

          {

            actions.length > 0 && (

              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  gap-2
                "
              >


                {

                  actions.map(
                    (action) => (

                      <button

                        key={
                          action.id
                        }

                        type="button"

                        onClick={
                          () =>
                            onAction?.(
                              suggestion,
                              action.id
                            )
                        }

                        className={`
                          rounded-lg
                          px-3
                          py-2
                          text-[11px]
                          font-semibold
                          transition

                          ${
                            action.primary

                              ? `
                                bg-[#315c46]
                                text-white
                                hover:bg-[#274c3a]
                              `

                              : `
                                border
                                border-[#dfe5da]
                                bg-white
                                text-[#52665b]
                                hover:bg-[#f7f9f4]
                              `
                          }
                        `}
                      >

                        {
                          action.label
                        }

                      </button>

                    )
                  )

                }


              </div>

            )

          }


        </div>


      </div>


    </div>

  );

}


// ============================================================
// AI SUGGESTION DETAILS MODAL
// ============================================================

export function AISuggestionDetailsModal(props) {
  return <AISuggestionDetailsModalComponent {...props} />;
}

function LegacyAISuggestionDetailsModal({ isOpen, suggestion, onClose, onRefresh, aiLoading }) {
  if (!isOpen || !suggestion) return null;

  const snapshot = suggestion.financialSnapshot || {};
  const external = suggestion.externalContext || {};
  const recommendations = Array.isArray(suggestion.recommendations) ? suggestion.recommendations : [];

  const getDecisionBadge = (decision = "CONSIDER") => {
    const d = String(decision).toUpperCase();
    if (d === "INVEST") {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (d === "DEBT_FIRST" || d === "AVOID_FOR_NOW") {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    if (d === "SAVE_FIRST" || d === "HOLD_LIQUIDITY") {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    if (d === "DIVERSIFY" || d === "INCREASE_EXISTING") {
      return "bg-teal-100 text-teal-800 border-teal-200";
    }
    return "bg-sky-100 text-sky-800 border-sky-200";
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#10251d]/60 p-4 sm:p-6 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#dfe8dc] bg-[#f8faf7] shadow-[0_25px_70px_rgba(24,57,44,0.25)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#dfe8dc] bg-gradient-to-r from-[#18392c] via-[#315c46] to-[#426d55] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
              <FiZap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#dceadd]">
                  {suggestion.category || "AI Strategy"}
                </span>
                {suggestion.overallHealth && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold text-white">
                    Health: {suggestion.overallHealth}
                  </span>
                )}
                {suggestion.selectedMonth && (
                  <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-[#e2f4de]">
                    {suggestion.selectedMonth} Context
                  </span>
                )}
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-white leading-snug">
                {suggestion.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={aiLoading}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 disabled:opacity-50 cursor-pointer"
                title="Refresh with live MongoDB & market data"
              >
                <FiRefreshCw size={12} className={aiLoading ? "animate-spin" : ""} />
                <span>{aiLoading ? "Analyzing..." : "Re-analyze"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section 1: Current Position */}
          <div className="rounded-2xl border border-[#dfe8dc] bg-[#f8faf7] p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
                1. Current Financial Position
              </p>
              <span className="text-[10px] text-[#6c8b72] font-semibold">
                Available to Allocate: ₹{(suggestion.currentPosition?.availableToAllocate ?? snapshot.availableToAllocate ?? 0).toLocaleString("en-IN")}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
              <div className="rounded-xl border border-[#e5ebe2] bg-white p-2 text-center">
                <p className="text-[10px] text-slate-400">Savings Rate</p>
                <p className="mt-0.5 text-xs font-bold text-[#315c46]">
                  {suggestion.currentPosition?.savingsRate ?? snapshot.savingsRate ?? 0}%
                </p>
              </div>
              <div className="rounded-xl border border-[#e5ebe2] bg-white p-2 text-center">
                <p className="text-[10px] text-slate-400">Emergency Buffer</p>
                <p className="mt-0.5 text-xs font-bold text-[#18392c]">
                  {suggestion.currentPosition?.emergencyFundMonths ?? snapshot.emergencyFundMonths ?? 0} months
                </p>
              </div>
              <div className="rounded-xl border border-[#e5ebe2] bg-white p-2 text-center">
                <p className="text-[10px] text-slate-400">Gold Exposure</p>
                <p className="mt-0.5 text-xs font-bold text-[#b38600]">
                  {suggestion.currentPosition?.goldExposurePercent ?? snapshot.goldExposurePercent ?? 0}%
                </p>
              </div>
              <div className="rounded-xl border border-[#e5ebe2] bg-white p-2 text-center">
                <p className="text-[10px] text-slate-400">Equity Exposure</p>
                <p className="mt-0.5 text-xs font-bold text-[#18392c]">
                  {suggestion.currentPosition?.equityExposurePercent ?? snapshot.equityExposurePercent ?? 0}%
                </p>
              </div>
            </div>

            {suggestion.currentPosition?.summary && (
              <p className="text-xs text-[#2c4739] leading-5 font-medium">
                {suggestion.currentPosition.summary}
              </p>
            )}
          </div>

          {/* Section 2: Market Insight */}
          <div className="rounded-2xl border border-[#e2ebd8] bg-white p-4 space-y-2.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
                2. Current Market Insight (Live & Verified)
              </p>
              <span className="text-[10px] text-[#6c8b72]">
                As of: {external.asOfFormatted || "Latest available"}
              </span>
            </div>

            {/* Multi-Asset Benchmarks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-2.5">
                <p className="text-[10px] text-slate-400">24K Spot Gold</p>
                <p className="mt-0.5 font-bold text-[#18392c]">
                  {external.goldPricePerGram24K
                    ? `₹${Number(external.goldPricePerGram24K).toLocaleString("en-IN")}/g`
                    : "Data unavailable"}
                </p>
                <p className="text-[9px] text-[#6c8b72]">{external.goldSource || "Bullion API"}</p>
              </div>

              <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-2.5">
                <p className="text-[10px] text-slate-400">Spot Silver</p>
                <p className="mt-0.5 font-bold text-[#18392c]">
                  {external.silverPricePerGram
                    ? `₹${Number(external.silverPricePerGram).toLocaleString("en-IN")}/g`
                    : "Data unavailable"}
                </p>
                <p className="text-[9px] text-[#6c8b72]">{external.silverSource || "Bullion Spot"}</p>
              </div>

              <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-2.5">
                <p className="text-[10px] text-slate-400">Nifty 50 Index</p>
                <p className="mt-0.5 font-bold text-[#18392c]">
                  {external.niftyCurrentValue
                    ? `${Number(external.niftyCurrentValue).toLocaleString("en-IN")}`
                    : "NSE Benchmark"}
                </p>
                <p className="text-[9px] text-[#6c8b72]">
                  {external.niftyDayChangePercent !== undefined && external.niftyDayChangePercent !== null
                    ? `${external.niftyDayChangePercent >= 0 ? "+" : ""}${external.niftyDayChangePercent}%`
                    : "10-Yr: 12.5%"}
                </p>
              </div>

              <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-2.5">
                <p className="text-[10px] text-slate-400">Bank FD Benchmark</p>
                <p className="mt-0.5 font-bold text-[#18392c]">
                  {external.benchmarkFDRate || "6.80% - 7.60%"}
                </p>
                <p className="text-[9px] text-[#6c8b72]">RBI Repo: {external.rbiRepoRate || "6.50%"}</p>
              </div>
            </div>

            {suggestion.marketInsight?.summary && (
              <p className="text-xs text-[#30483c] leading-5 pt-1">
                <strong>Situation:</strong> {suggestion.marketInsight.summary}
              </p>
            )}
          </div>

          {/* Section 3: Personalized Suggestion */}
          <div className="rounded-2xl border border-[#dcebd4] bg-[#f4faef] p-4.5 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
              3. Personalized Suggestion
            </p>
            <p className="text-xs sm:text-sm font-semibold text-[#18392c] leading-6">
              {suggestion.personalizedSuggestion?.text || suggestion.summary}
            </p>
            {suggestion.personalizedSuggestion?.reason && (
              <p className="text-xs text-[#3d5a4a] leading-5 bg-white/70 rounded-xl p-2.5 border border-[#e2ebde]">
                <strong>Financial Rationale:</strong> {suggestion.personalizedSuggestion.reason}
              </p>
            )}
          </div>

          {/* Section 4: Future Outlook (Scenario-Based) */}
          <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46]">
                4. Future Outlook (Scenario-Based)
              </p>
              <span className="text-[9px] text-slate-400 font-semibold">Non-Guaranteed Scenarios</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#315c46] mb-1">
                  Base Case
                </p>
                <p className="text-slate-600 leading-5">
                  {suggestion.futureOutlook?.baseCase || "Moderate growth with range-bound asset valuations in the short to medium term."}
                </p>
              </div>

              <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#2e7d32] mb-1">
                  Bull Case
                </p>
                <p className="text-slate-600 leading-5">
                  {suggestion.futureOutlook?.bullCase || "Easing inflation and steady domestic earnings accelerate portfolio capital compounding."}
                </p>
              </div>

              <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#c62828] mb-1">
                  Bear Case
                </p>
                <p className="text-slate-600 leading-5">
                  {suggestion.futureOutlook?.bearCase || "Global macroeconomic uncertainty or commodity volatility could trigger interim market pullbacks."}
                </p>
              </div>
            </div>

            {Array.isArray(suggestion.futureOutlook?.keyRisks) && suggestion.futureOutlook.keyRisks.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Key Risk Factors to Monitor:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.futureOutlook.keyRisks.map((risk, rIdx) => (
                    <span
                      key={rIdx}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] text-slate-600 font-medium border border-slate-200"
                    >
                      • {risk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Structured Strategy Items */}
          {recommendations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#18392c]">
                  5. Actionable Allocations & Strategy Items
                </p>
                <span className="text-[11px] text-slate-500">
                  {recommendations.length} item{recommendations.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#e2e8dc] bg-white p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#18392c]">
                          {rec.title}
                        </span>
                        <span className="rounded-full bg-[#f0f4ee] px-2 py-0.5 text-[10px] font-semibold text-[#426150]">
                          {rec.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${getDecisionBadge(
                            rec.decision
                          )}`}
                        >
                          {rec.decision || "CONSIDER"}
                        </span>
                        {rec.priority && (
                          <span className="text-[10px] font-medium text-slate-400">
                            • {rec.priority} Priority
                          </span>
                        )}
                      </div>
                    </div>

                    {rec.message && (
                      <p className="text-xs leading-5 text-slate-700 font-medium">
                        {rec.message}
                      </p>
                    )}

                    {rec.reason && (
                      <p className="text-xs leading-5 text-[#335343] bg-[#f8fbf6] rounded-xl p-2.5 border border-[#e5ece2]">
                        <strong>Rationale:</strong> {rec.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Mandatory One-Line Risk Disclaimer */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 shadow-xs">
            <span className="text-amber-700 text-xs mt-0.5">⚠️</span>
            <p className="text-xs font-semibold text-amber-900 leading-snug">
              {suggestion.riskDisclaimer || "Invest at your own risk — market prices and conditions can change, and values may increase or decrease."}
            </p>
          </div>

          {/* Metadata Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6ebe5] pt-2 text-[10px] text-slate-400">
            <span>
              Last analyzed: {new Date(suggestion.createdAt || Date.now()).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>
              Sources: {external.source || "RBI, NSE, AMFI & Bullion Spot Feeds"}
            </span>
            <span>
              Engine: {suggestion.modelUsed ? `Gemini (${suggestion.modelUsed})` : "FinanceOS AI Adviser"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#dfe8dc] bg-white px-6 py-4">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#315c46] bg-[#f2f7f0] px-4 py-2 text-xs font-semibold text-[#18392c] shadow-xs transition hover:bg-[#e4efe0] disabled:opacity-50 cursor-pointer"
            >
              <FiRefreshCw size={12} className={aiLoading ? "animate-spin text-[#315c46]" : "text-[#315c46]"} />
              <span>{aiLoading ? "Analyzing latest data..." : "Re-analyze Now"}</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d7e1d5] bg-white px-5 py-2.5 text-xs font-semibold text-[#52665b] transition hover:bg-[#f4f7f1] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXPORT
// ============================================================

export default FinancialSuggestions;