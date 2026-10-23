// ============================================================
// FINANCEOS - AI SUGGESTION MODEL
// Single Source of Truth for Gemini AI Recommendations
// ============================================================

const mongoose = require("mongoose");

const numericFactSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    value: { type: mongoose.Schema.Types.Mixed },
    unit: { type: String, default: "" },
    source: { type: String, default: "" },
    asOf: { type: String, default: "" },
    status: { type: String, default: "Current / Verified" },
  },
  { _id: false }
);

const sourceSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    url: { type: String, default: "" },
    sourceType: { type: String, default: "market-data" }, // market-data | web | maps | official
  },
  { _id: false }
);

const recommendationItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low", "high", "medium", "low"],
      default: "Medium",
    },
    decision: {
      type: String,
      enum: [
        "INVEST",
        "CONSIDER",
        "WAIT",
        "AVOID_FOR_NOW",
        "SAVE_FIRST",
        "DEBT_FIRST",
        "DIVERSIFY",
        "REVIEW_EXISTING",
        "HOLD_LIQUIDITY",
        "INCREASE_EXISTING",
        "REDUCE_CONCENTRATION",
      ],
      default: "CONSIDER",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    suggestedAction: {
      type: String,
      default: "",
      trim: true,
    },
    suggestedAmount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    relatedModule: {
      type: String,
      default: "General",
    },
    numericFacts: [numericFactSchema],
    sources: [sourceSchema],
  },
  { _id: false }
);

const actionStepSchema = new mongoose.Schema(
  {
    step: {
      type: Number,
      default: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low", "High", "Medium", "Low"],
      default: "medium",
    },
    suggestedAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const aiSuggestionSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Main recommendation headline & summary
    title: {
      type: String,
      required: true,
      trim: true,
    },

    summary: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "Financial Strategy",
      trim: true,
    },

    overallHealth: {
      type: String,
      default: "Good",
      trim: true,
    },

    // Structured Recommendations
    recommendations: [recommendationItemSchema],

    // Comprehensive breakdown & action steps
    detailedAdvice: {
      type: String,
      default: "",
      trim: true,
    },

    keyObservations: [
      {
        type: String,
        trim: true,
      },
    ],

    actionSteps: [actionStepSchema],

    // Financial Position at time of analysis
    financialPosition: {
      availableToAllocate: { type: Number, default: 0 },
      netWorth: { type: Number, default: 0 },
      totalAssets: { type: Number, default: 0 },
      totalLiabilities: { type: Number, default: 0 },
    },

    // Normalized Financial Snapshot at time of generation
    financialSnapshot: {
      income: { type: Number, default: 0 },
      expenses: { type: Number, default: 0 },
      monthlySavings: { type: Number, default: 0 },
      savingsRate: { type: Number, default: 0 },
      totalCommitments: { type: Number, default: 0 },
      monthlyInvestmentCommitment: { type: Number, default: 0 },
      monthlyInsuranceCommitment: { type: Number, default: 0 },
      monthlyLiabilityCommitment: { type: Number, default: 0 },
      availableToAllocate: { type: Number, default: 0 },
      totalInvestments: { type: Number, default: 0 },
      totalLiabilities: { type: Number, default: 0 },
      totalInsurancePremiums: { type: Number, default: 0 },
      totalGoalSaved: { type: Number, default: 0 },
      netWorth: { type: Number, default: 0 },
      emergencyFundMonths: { type: Number, default: 0 },
      activeGoalsCount: { type: Number, default: 0 },
      maturedInvestmentsCount: { type: Number, default: 0 },
      activeSIPsCount: { type: Number, default: 0 },
      activeFDsCount: { type: Number, default: 0 },
      goldHoldingsCount: { type: Number, default: 0 },
      stockHoldingsCount: { type: Number, default: 0 },
    },

    // Structured Short AI Suggestion Sections (100 - 180 words format)
    currentPosition: {
      availableToAllocate: { type: Number, default: 0 },
      savingsRate: { type: Number, default: 0 },
      emergencyFundMonths: { type: Number, default: 0 },
      totalLiabilities: { type: Number, default: 0 },
      goldExposurePercent: { type: Number, default: 0 },
      equityExposurePercent: { type: Number, default: 0 },
      summary: { type: String, default: "" },
    },

    marketInsight: {
      summary: { type: String, default: "" },
      goldSpotFormatted: { type: String, default: "" },
      silverSpotFormatted: { type: String, default: "" },
      niftyIndexFormatted: { type: String, default: "" },
      fdRangeFormatted: { type: String, default: "" },
      keyFactors: [{ type: String, trim: true }],
    },

    personalizedSuggestion: {
      text: { type: String, default: "" },
      reason: { type: String, default: "" },
      priority: { type: String, default: "Medium" },
      actionCategory: { type: String, default: "General" },
    },

    futureOutlook: {
      baseCase: { type: String, default: "" },
      bullCase: { type: String, default: "" },
      bearCase: { type: String, default: "" },
      keyRisks: [{ type: String, trim: true }],
    },

    // Mandatory One-Line Risk Disclaimer (Always Visible)
    riskDisclaimer: {
      type: String,
      default: "Invest at your own risk — market prices and conditions can change, and values may increase or decrease.",
    },

    // What Should I Do With My Money? (Friendly 3-Section Format)
    yourSituation: {
      text: { type: String, default: "" },
      availableAmount: { type: Number, default: 0 },
      emergencyBufferText: { type: String, default: "" },
      summary: { type: String, default: "" },
    },

    yourOptions: [
      {
        option: { type: String, required: true },
        category: { type: String, default: "General" },
        whyFits: { type: String, default: "" },
        risks: { type: String, default: "" },
        suitability: { type: String, default: "Consider" },
        amount: { type: Number, default: 0 },
        officialLink: { type: String, default: "" },
      },
    ],

    yourNextStep: {
      action: { type: String, default: "" },
      why: { type: String, default: "" },
      risks: { type: String, default: "" },
      missingInfo: { type: String, default: "" },
      officialLink: { type: String, default: "" },
    },

    // Terminology Explanations (SIP, NAV, FD, IPO, GMP, EMI, Mutual Fund)
    termsExplained: [
      {
        term: { type: String },
        definition: { type: String },
      },
    ],

    // Stocks to Research
    stocksForResearch: [mongoose.Schema.Types.Mixed],

    // 1. Investment Readiness Evaluation (Section 5)
    investmentReadiness: {
      isReadyToInvest: { type: Boolean, default: true },
      status: { type: String, default: "READY" }, // READY | DEBT_FIRST | EMERGENCY_RESERVE_FIRST | DEFICIT_RECOVERY | HOLD_LIQUIDITY
      priorityRecommendation: { type: String, default: "INVEST" },
      passedChecksCount: { type: Number, default: 0 },
      totalChecksCount: { type: Number, default: 9 },
      checks: [
        {
          id: { type: String },
          title: { type: String },
          passed: { type: Boolean },
          details: { type: String },
        },
      ],
      unresolvedConcerns: [{ type: String, trim: true }],
    },

    // 2. Loan Repayment vs Investment vs FD Analysis (Section 6.A)
    loanVsInvestmentAnalysis: {
      hasActiveLoans: { type: Boolean, default: false },
      hasMaturingInvestments: { type: Boolean, default: false },
      loanSummary: {
        principal: { type: Number, default: 0 },
        interestRate: { type: Number, default: 0 },
        monthlyEMI: { type: Number, default: 0 },
        remainingTenureMonths: { type: Number, default: 0 },
      },
      waitingInterestCost: { type: Number, default: 0 },
      grossInterestSaved: { type: Number, default: 0 },
      prepaymentPenalty: { type: Number, default: 0 },
      netInterestSaved: { type: Number, default: 0 },
      tenureMonthsSaved: { type: Number, default: 0 },
      recommendation: { type: String, default: "" },
      rationale: { type: String, default: "" },
    },

    // 3. Maturity-to-Action Plan (Section 6.B)
    maturityToAction: {
      hasMaturingInvestment: { type: Boolean, default: false },
      hasMaturingItems: { type: Boolean, default: false },
      maturingItems: [
        {
          id: { type: String },
          name: { type: String },
          type: { type: String },
          maturityDateFormatted: { type: String },
          daysRemaining: { type: Number },
          amount: { type: Number },
          isConfirmedAmount: { type: Boolean },
        },
      ],
      primaryItem: {
        name: { type: String, default: "" },
        daysRemaining: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        maturityDateFormatted: { type: String, default: "" },
      },
      recommendation: { type: String, default: "" },
      why: { type: String, default: "" },
    },

    // 4. Verified Bank FD & Deposit Terms (Section 6.D)
    bankFDComparison: {
      benchmarkRange: { type: String, default: "6.80% - 7.60%" },
      dicgcInsuranceLimit: { type: Number, default: 500000 },
      taxation: { type: String, default: "Interest taxable as per slab rate; TDS applies above ₹40,000/yr." },
      institutions: [
        {
          bank: { type: String },
          tenure: { type: String },
          generalRate: { type: String },
          seniorRate: { type: String },
          specialTenureScheme: { type: String },
          prematurePenalty: { type: String },
          dicgcInsured: { type: Boolean, default: true },
          sourceUrl: { type: String },
        },
      ],
      recommendedTenure: { type: String, default: "1 Year to 18 Months" },
      recommendedBank: { type: String, default: "SBI / HDFC / ICICI" },
      rationale: { type: String, default: "" },
    },

    // 5. Actionable Comparison Matrix (Section 6.E)
    comparisonMatrix: [
      {
        id: { type: String },
        choice: { type: String },
        purpose: { type: String },
        whyToConsider: { type: String },
        mainTradeOff: { type: String },
        rank: { type: Number },
        suitability: { type: String },
        risk: { type: String },
        liquidity: { type: String },
        timeHorizon: { type: String },
        illustrativeAllocation: { type: Number, default: 0 },
      },
    ],

    // 6. Recommended Investment Categories (Section 4)
    recommendedCategories: [
      {
        category: { type: String },
        suitability: { type: String },
        rationale: { type: String },
        timeHorizon: { type: String },
        riskLevel: { type: String },
        liquidity: { type: String },
        taxImplications: { type: String },
        alternatives: { type: String },
      },
    ],

    // External verified multi-asset market context
    externalContext: {
      // Gold
      goldPricePerGram24K: { type: Number, default: null },
      goldPricePerGram22K: { type: Number, default: null },
      goldAvailable: { type: Boolean, default: false },
      goldCurrency: { type: String, default: "INR" },
      goldUnit: { type: String, default: "₹ / gram" },
      goldSource: { type: String, default: "" },

      // Silver
      silverPricePerGram: { type: Number, default: null },
      silverPricePerKg: { type: Number, default: null },
      silverAvailable: { type: Boolean, default: false },
      silverSource: { type: String, default: "" },

      // Equities / Nifty 50
      niftyCurrentValue: { type: Number, default: null },
      niftyDayChange: { type: Number, default: null },
      niftyDayChangePercent: { type: Number, default: null },
      niftyHistoricalCAGR: { type: String, default: "12.50%" },
      niftyAvailable: { type: Boolean, default: false },
      equitiesSource: { type: String, default: "National Stock Exchange of India (NSE)" },

      // Mutual Funds
      mutualFundNav: { type: Number, default: null },
      mutualFundScheme: { type: String, default: "" },
      mutualFundAvailable: { type: Boolean, default: false },
      mutualFundSource: { type: String, default: "AMFI India" },

      // Fixed & Recurring Deposits
      rbiRepoRate: { type: String, default: "6.50%" },
      benchmarkFDRate: { type: String, default: "6.80% - 7.60%" },
      benchmarkRDRate: { type: String, default: "6.80% - 7.10%" },
      fdAvailable: { type: Boolean, default: true },
      fdSource: { type: String, default: "RBI & Scheduled Commercial Banks" },

      // Property & Real Estate
      propertyTrend: { type: String, default: "8.5% - 11.2% YoY growth across Tier-1 metros" },
      propertyAvailable: { type: Boolean, default: true },
      propertySource: { type: String, default: "National Housing Bank (NHB RESIDEX)" },

      // IPO
      ipoMarketStatus: { type: String, default: "Active primary market pipeline; valuation scrutiny elevated" },
      ipoAvailable: { type: Boolean, default: true },
      ipoSource: { type: String, default: "BSE / NSE Primary Market" },

      // Macro & Inflation
      inflationRate: { type: String, default: "4.80%" },
      usdInrRate: { type: Number, default: null },
      marketTrend: { type: String, default: "Stable monetary policy with balanced equity & commodity dynamics" },
      marketDataStatus: { type: String, default: "" },
      source: { type: String, default: "RBI, NSE, AMFI, NHB & Bullion Market" },
      fetchedAt: { type: Date, default: Date.now },
      asOfFormatted: { type: String, default: "" },
    },

    // Context metadata
    promptContextType: {
      type: String,
      enum: ["plans_commitments", "dashboard_advisor", "dashboard", "maturity_action", "general"],
      default: "plans_commitments",
    },

    selectedMonth: {
      type: String,
      default: "",
    },

    targetItemName: {
      type: String,
      default: "",
      trim: true,
    },

    modelUsed: {
      type: String,
      default: "gemini-2.5-flash",
    },

    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Fast compound index for user's latest suggestions
aiSuggestionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("AISuggestion", aiSuggestionSchema);
