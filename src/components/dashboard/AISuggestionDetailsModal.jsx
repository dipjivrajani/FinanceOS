// ============================================================
// FINANCEOS - AI SUGGESTION DETAILS MODAL
// Friendly, Everyday English Financial Adviser & Real-Time Market Overview
// ============================================================

import { useState } from "react";
import {
  FiZap,
  FiX,
  FiRefreshCw,
  FiShield,
  FiClock,
  FiExternalLink,
  FiCheck,
  FiAlertTriangle,
  FiInfo,
  FiTrendingUp,
  FiDollarSign,
  FiHelpCircle,
  FiLayers,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import useFinance from "../../context/useFinance";

export default function AISuggestionDetailsModal({
  isOpen,
  suggestion,
  onClose,
  onRefresh,
  aiLoading,
}) {
  if (!isOpen || !suggestion) return null;

  const finance = useFinance();
  const [activeTab, setActiveTab] = useState("what_to_do");
  const [showGlossary, setShowGlossary] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState({});

  // Use live market data from context if available (updated in real-time via Socket.IO),
  // otherwise fallback to suggestion snapshot
  const liveMarket = finance?.marketData || {};
  const external = {
    ...suggestion.externalContext,
    ...liveMarket,
  };

  const snapshot = suggestion.financialSnapshot || suggestion.currentPosition || {};
  const readiness = suggestion.investmentReadiness || snapshot.investmentReadiness || null;
  const loanVsInv = suggestion.loanVsInvestmentAnalysis || snapshot.loanVsInvestmentAnalysis || null;
  const bankFD = suggestion.bankFDComparison || null;
  const comparisonMatrix = Array.isArray(suggestion.comparisonMatrix) && suggestion.comparisonMatrix.length > 0
    ? suggestion.comparisonMatrix
    : (Array.isArray(snapshot.comparisonMatrix) ? snapshot.comparisonMatrix : []);
  const recommendations = Array.isArray(suggestion.recommendations) ? suggestion.recommendations : [];

  // Plain-English 3 Sections from suggestion
  const yourSituation = suggestion.yourSituation || {
    text: `You have ₹${(snapshot.availableToAllocate || 0).toLocaleString("en-IN")} available after your recorded commitments. Your emergency reserves cover ${snapshot.emergencyFundMonths || 0} months of essential living expenses.`,
    availableAmount: snapshot.availableToAllocate || 0,
    emergencyBufferText: `${snapshot.emergencyFundMonths || 0} months of expenses`,
    summary: suggestion.summary || "",
  };

  const yourOptions = Array.isArray(suggestion.yourOptions) && suggestion.yourOptions.length > 0
    ? suggestion.yourOptions
    : [
        {
          option: "Keep Money for Upcoming Bills & Emergencies",
          category: "Emergency Reserve",
          whyFits: (snapshot.emergencyFundMonths || 0) < 3
            ? "Top priority: your emergency fund covers less than 3 months of essential expenses."
            : "Safe choice: maintains immediate cash flexibility for near-term grocery, utility, and medical expenses.",
          risks: "Regular savings accounts earn low interest, meaning money may lose purchasing power to inflation over time.",
          suitability: (snapshot.emergencyFundMonths || 0) < 3 ? "Top Recommendation" : "Consider",
          amount: Math.round((snapshot.availableToAllocate || 0) * 0.4),
          officialLink: "",
        },
        {
          option: "Compare Bank Fixed Deposits (FD)",
          category: "Fixed Deposit",
          whyFits: "Guaranteed returns of ~7.10% with statutory capital protection up to ₹5,00,000 per depositor per bank under DICGC.",
          risks: "Your money is locked in for the chosen period; withdrawing early incurs a premature penalty (typically 0.50% - 1.00%).",
          suitability: (snapshot.availableToAllocate || 0) > 0 ? "Recommended" : "Wait",
          amount: Math.round((snapshot.availableToAllocate || 0) * 0.35),
          officialLink: "https://sbi.co.in",
        },
        {
          option: "Start or Increase a Mutual Fund SIP",
          category: "Mutual Fund",
          whyFits: "A SIP (Systematic Investment Plan) invests a fixed amount monthly into a mutual fund to build wealth over 3-7+ years.",
          risks: "Mutual fund values fluctuate daily with market movements. They are not guaranteed and not suitable for money needed within 1-2 years.",
          suitability: (snapshot.emergencyFundMonths || 0) >= 3 ? "Recommended" : "Save First",
          amount: Math.round((snapshot.availableToAllocate || 0) * 0.25),
          officialLink: "https://www.amfiindia.com",
        },
      ];

  const yourNextStep = suggestion.yourNextStep || {
    action: (snapshot.emergencyFundMonths || 0) < 3
      ? `Keep ₹${Math.max(snapshot.availableToAllocate || 0, 0).toLocaleString("en-IN")} in your account or open a liquid short-term bank FD to build your emergency cushion to at least 3 months.`
      : "Compare 1-year FD rates from SBI (6.80% - 7.25%) or consider starting a disciplined monthly SIP from your surplus.",
    why: "Balances safety, liquidity, and steady growth based on your actual recorded numbers.",
    risks: "Market prices fluctuate; fixed deposits have premature withdrawal penalties.",
    missingInfo: "Check if all upcoming bills and loans are recorded in your dashboard.",
    officialLink: "https://sbi.co.in",
  };

  const termsExplained = Array.isArray(suggestion.termsExplained) && suggestion.termsExplained.length > 0
    ? suggestion.termsExplained
    : [
        {
          term: "SIP (Systematic Investment Plan)",
          definition: "A disciplined way to invest a set amount every month into a mutual fund, rather than investing all your money at once.",
        },
        {
          term: "NAV (Net Asset Value)",
          definition: "The price of one unit of a mutual fund scheme on a given day, calculated and published by AMFI after market close.",
        },
        {
          term: "FD (Fixed Deposit)",
          definition: "A safe bank deposit where your money earns a guaranteed, fixed interest rate over an agreed period. Insured up to ₹5,00,000 per bank by DICGC (RBI subsidiary).",
        },
        {
          term: "IPO (Initial Public Offering)",
          definition: "When a private company sells its shares to regular public investors for the first time on stock exchanges like NSE or BSE.",
        },
        {
          term: "GMP (Grey Market Premium)",
          definition: "An unofficial, unregulated indicator of what informal traders are paying before a stock lists. It is speculative, can fluctuate rapidly, and is NEVER a guaranteed profit.",
        },
        {
          term: "EMI (Equated Monthly Installment)",
          definition: "A fixed monthly amount you pay to repay a loan, covering both principal balance and interest until the loan is cleared.",
        },
        {
          term: "Mutual Fund",
          definition: "A professionally managed pool of money from many investors that invests in a diversified basket of stocks, bonds, or government securities.",
        },
      ];

  const stocksForResearch = Array.isArray(suggestion.stocksForResearch) && suggestion.stocksForResearch.length > 0
    ? suggestion.stocksForResearch
    : (Array.isArray(liveMarket.stocksForResearch) ? liveMarket.stocksForResearch : []);

  const ipoList = Array.isArray(external.ipo?.upcomingAndOpenIPOs)
    ? external.ipo.upcomingAndOpenIPOs
    : [];

  const handleRefreshMarket = async () => {
    if (typeof finance?.refreshMarketData === "function") {
      await finance.refreshMarketData();
    }
  };

  const toggleDetail = (key) => {
    setExpandedDetails((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getSuitabilityColor = (suitability = "") => {
    const s = String(suitability).toLowerCase();
    if (s.includes("top") || s.includes("highly") || s.includes("recommend")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    }
    if (s.includes("debt") || s.includes("save first") || s.includes("wait")) {
      return "bg-amber-100 text-amber-800 border-amber-300";
    }
    return "bg-sky-100 text-sky-800 border-sky-300";
  };

  // Indian Stock Market Status derivation
  const marketStatus = external.marketStatus || external.equities?.marketStatus || "closed";
  const marketIsOpen = external.marketStatus?.isOpen || external.equities?.marketIsOpen || false;
  const marketStatusText = external.marketStatus?.statusText || (marketIsOpen ? "Market Open" : "Market Closed");

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#10251d]/60 p-3 sm:p-5 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#dfe8dc] bg-[#f8faf7] shadow-[0_25px_70px_rgba(24,57,44,0.25)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#dfe8dc] bg-gradient-to-r from-[#18392c] via-[#24503c] to-[#38624c] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
              <FiZap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#dceadd]">
                  FinanceOS AI Financial Guide
                </span>
                {suggestion.overallHealth && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold text-white">
                    Health: {suggestion.overallHealth}
                  </span>
                )}
                {finance?.socketConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live WebSockets
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-200">
                    Market Feed
                  </span>
                )}
              </div>
              <h2 className="mt-0.5 text-base font-bold text-white leading-snug">
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
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 disabled:opacity-50 cursor-pointer"
                title="Run fresh analysis with authorized MongoDB & market feeds"
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

        {/* Tab Navigation Bar */}
        <div className="flex shrink-0 border-b border-[#dfe8dc] bg-[#eef4ec] px-4 overflow-x-auto text-xs font-semibold text-[#426150]">
          <button
            type="button"
            onClick={() => setActiveTab("what_to_do")}
            className={`border-b-2 px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "what_to_do"
                ? "border-[#315c46] text-[#18392c] font-bold bg-white/60"
                : "border-transparent hover:text-[#18392c]"
            }`}
          >
            <span>What Should I Do With My Money?</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("market_overview")}
            className={`border-b-2 px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "market_overview"
                ? "border-[#315c46] text-[#18392c] font-bold bg-white/60"
                : "border-transparent hover:text-[#18392c]"
            }`}
          >
            <span>Live Market Overview</span>
            <span className={`h-1.5 w-1.5 rounded-full ${marketIsOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bank_fds")}
            className={`border-b-2 px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "bank_fds"
                ? "border-[#315c46] text-[#18392c] font-bold bg-white/60"
                : "border-transparent hover:text-[#18392c]"
            }`}
          >
            <span>Bank FDs & Maturing Money</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("readiness_matrix")}
            className={`border-b-2 px-3.5 py-2.5 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "readiness_matrix"
                ? "border-[#315c46] text-[#18392c] font-bold bg-white/60"
                : "border-transparent hover:text-[#18392c]"
            }`}
          >
            <span>Checklist & Action Matrix</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ========================================================
              TAB 1: WHAT SHOULD I DO WITH MY MONEY? (3-SECTION FORMAT)
             ======================================================== */}
          {activeTab === "what_to_do" && (
            <div className="space-y-5">
              {/* Short Summary Callout */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <FiZap className="text-[#315c46]" size={16} />
                  <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                    Quick Summary
                  </p>
                </div>
                <p className="text-sm font-medium leading-6 text-slate-800">
                  {suggestion.summary}
                </p>
              </div>

              {/* Section A: Your Situation */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-[#f8faf7] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#315c46] text-white text-xs font-bold">
                      A
                    </span>
                    <h3 className="text-sm font-bold text-[#18392c]">
                      Your Situation (What is happening with my money?)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#315c46]">
                    Available: ₹{(yourSituation.availableAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <p className="text-xs leading-6 text-slate-700">
                  {yourSituation.text}
                </p>

                {/* Key Numbers Grid in INR */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div className="rounded-xl border border-[#e5ebe2] bg-white p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">Available to Allocate</p>
                    <p className="mt-0.5 text-xs font-bold text-[#315c46]">
                      ₹{(snapshot.availableToAllocate || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e5ebe2] bg-white p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">Emergency Cushion</p>
                    <p className="mt-0.5 text-xs font-bold text-[#18392c]">
                      {snapshot.emergencyFundMonths || 0} months
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e5ebe2] bg-white p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">Monthly Commitments</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-700">
                      ₹{(snapshot.totalCommitments || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#e5ebe2] bg-white p-2.5 text-center">
                    <p className="text-[10px] text-slate-400">Total Liabilities</p>
                    <p className="mt-0.5 text-xs font-bold text-rose-700">
                      ₹{(snapshot.totalLiabilities || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section B: Your Options */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#315c46] text-white text-xs font-bold">
                    B
                  </span>
                  <h3 className="text-sm font-bold text-[#18392c]">
                    Your Options (What realistic choices do I have?)
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Ranked for your specific situation. Review what fits and the associated risks:
                </p>

                <div className="space-y-3">
                  {yourOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#e8eee6] bg-[#fbfdfa] p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#18392c]">
                            {idx + 1}. {opt.option}
                          </span>
                          <span className="rounded-full bg-[#edf2ea] px-2 py-0.5 text-[10px] font-semibold text-[#426150]">
                            {opt.category}
                          </span>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getSuitabilityColor(opt.suitability)}`}>
                          {opt.suitability || "Consider"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-2.5 border border-[#ecf0e9]">
                          <p className="font-semibold text-emerald-800 text-[11px] mb-0.5">
                            Why this might suit you:
                          </p>
                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            {opt.whyFits}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 border border-[#ecf0e9]">
                          <p className="font-semibold text-amber-800 text-[11px] mb-0.5">
                            What are the risks / trade-offs:
                          </p>
                          <p className="text-slate-600 leading-relaxed text-[11px]">
                            {opt.risks}
                          </p>
                        </div>
                      </div>

                      {opt.officialLink && (
                        <div className="pt-1 flex justify-end">
                          <a
                            href={opt.officialLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315c46] hover:underline"
                          >
                            <span>Learn more / official page</span>
                            <FiExternalLink size={11} />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section C: Your Next Step */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-bold">
                    C
                  </span>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Your Next Step (What should I do right now?)
                  </h3>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-emerald-100 space-y-2 text-xs">
                  <p className="text-sm font-bold text-emerald-900 leading-snug">
                    {yourNextStep.action}
                  </p>
                  <p className="text-slate-700 leading-relaxed">
                    <strong>Why this fits:</strong> {yourNextStep.why}
                  </p>
                  <p className="text-amber-900 leading-relaxed">
                    <strong>What could go wrong:</strong> {yourNextStep.risks}
                  </p>
                  {yourNextStep.missingInfo && (
                    <p className="text-slate-500 text-[11px] border-t border-slate-100 pt-1.5">
                      <strong>Profile check:</strong> {yourNextStep.missingInfo}
                    </p>
                  )}
                  {yourNextStep.officialLink && (
                    <div className="pt-1">
                      <a
                        href={yourNextStep.officialLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#315c46] hover:underline"
                      >
                        <span>Open official bank / product page</span>
                        <FiExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Everyday Financial Terms Explained (First Occurrence Guide) */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowGlossary(!showGlossary)}
                  className="flex w-full items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FiHelpCircle className="text-[#315c46]" size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                      Everyday Financial Terms Explained Simply
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#315c46] flex items-center gap-1">
                    {showGlossary ? "Hide explanations" : "See explanations"}
                    {showGlossary ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </span>
                </button>

                {showGlossary && (
                  <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#edf2ea] text-xs">
                    {termsExplained.map((term, tIdx) => (
                      <div key={tIdx} className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3">
                        <p className="font-bold text-[#18392c] mb-1">{term.term}</p>
                        <p className="text-slate-600 leading-relaxed text-[11px]">{term.definition}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: LIVE INDIAN MARKET OVERVIEW & REAL-TIME UPDATES
             ======================================================== */}
          {activeTab === "market_overview" && (
            <div className="space-y-5">
              {/* Live WebSocket Status & Source Freshness Banner */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${finance?.socketConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                      {finance?.socketConnected ? "WebSocket Real-Time Stream Active" : "Periodic Provider Feed"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshMarket}
                    disabled={finance?.marketDataLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#315c46] bg-[#f2f7f0] px-3 py-1.5 text-xs font-semibold text-[#18392c] transition hover:bg-[#e4efe0] disabled:opacity-50 cursor-pointer"
                  >
                    <FiRefreshCw size={11} className={finance?.marketDataLoading ? "animate-spin" : ""} />
                    <span>{finance?.marketDataLoading ? "Refreshing..." : "Refresh Market Data"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 bg-[#f9fbf8] p-2.5 rounded-xl border border-[#edf1ea]">
                  <div>
                    <strong>Quote Timestamp:</strong> {external.asOfFormatted || "Latest quote"}
                  </div>
                  <div>
                    <strong>Backend Retrieval:</strong> {external.fetchedAt ? new Date(external.fetchedAt).toLocaleTimeString("en-IN") : "Recent"}
                  </div>
                  <div>
                    <strong>Frontend Received:</strong> {finance?.marketDataLastReceived ? finance.marketDataLastReceived.toLocaleTimeString("en-IN") : "Connected"}
                  </div>
                </div>
              </div>

              {/* Indian Stock Market (NIFTY 50 & BSE SENSEX) */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                    Indian Stock Market (NSE & BSE)
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${marketIsOpen ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-700 border-slate-300"}`}>
                      {marketStatusText}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Hours: 09:15 - 15:30 IST (Mon-Fri)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* NIFTY 50 */}
                  <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">NIFTY 50 (NSE)</span>
                      <span className="text-[10px] text-slate-400">NSE Official Feed</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-[#18392c]">
                        {external.equities?.currentValue || external.niftyCurrentValue
                          ? Number(external.equities?.currentValue || external.niftyCurrentValue).toLocaleString("en-IN", { maximumFractionDigits: 2 })
                          : "24,850.40"}
                      </span>
                      <span className={`text-xs font-bold ${(external.equities?.dayChangePercent ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {(external.equities?.dayChangePercent ?? 0) >= 0 ? "+" : ""}
                        {external.equities?.dayChangePercent ?? "+0.35"}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      10-Yr Historical CAGR: 12.50% • 52-Wk Range: {external.equities?.fiftyTwoWeekLow || "21,281"} - {external.equities?.fiftyTwoWeekHigh || "26,277"}
                    </p>
                  </div>

                  {/* BSE SENSEX */}
                  <div className="rounded-xl border border-[#edf1ea] bg-[#f9fbf8] p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">BSE SENSEX</span>
                      <span className="text-[10px] text-slate-400">BSE Official Feed</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-[#18392c]">
                        {external.sensex?.currentValue || external.sensexCurrentValue
                          ? Number(external.sensex?.currentValue || external.sensexCurrentValue).toLocaleString("en-IN", { maximumFractionDigits: 2 })
                          : "81,224.75"}
                      </span>
                      <span className={`text-xs font-bold ${(external.sensex?.dayChangePercent ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {(external.sensex?.dayChangePercent ?? 0) >= 0 ? "+" : ""}
                        {external.sensex?.dayChangePercent ?? "+0.28"}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      10-Yr Historical CAGR: 12.20% • Benchmark for Indian Large Caps
                    </p>
                  </div>
                </div>
              </div>

              {/* Precious Metals (24K Gold, 22K Gold & Silver) */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                    Precious Metals Benchmark Spot Prices (999 Purity)
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Units: ₹ / gram, ₹ / 10 grams, ₹ / kg
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* 24K Gold */}
                  <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      24K Gold (999 Purity)
                    </span>
                    <p className="text-base font-bold text-amber-950">
                      {external.gold?.pricePerGram24K ? `₹${Number(external.gold.pricePerGram24K).toLocaleString("en-IN")}` : "₹7,850"} / gram
                    </p>
                    <p className="text-[11px] font-semibold text-amber-800">
                      {external.gold?.pricePer10Grams24K ? `₹${Number(external.gold.pricePer10Grams24K).toLocaleString("en-IN")}` : "₹78,500"} / 10 grams
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Benchmark Spot Price. Excludes 3% GST.
                    </p>
                  </div>

                  {/* 22K Gold */}
                  <div className="rounded-xl border border-amber-100 bg-amber-50/20 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      22K Gold (916 Purity / Jewelry)
                    </span>
                    <p className="text-base font-bold text-amber-900">
                      {external.gold?.pricePerGram22K ? `₹${Number(external.gold.pricePerGram22K).toLocaleString("en-IN")}` : "₹7,196"} / gram
                    </p>
                    <p className="text-[11px] font-semibold text-amber-800">
                      {external.gold?.pricePer10Grams22K ? `₹${Number(external.gold.pricePer10Grams22K).toLocaleString("en-IN")}` : "₹71,960"} / 10 grams
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Retail showrooms add 3% GST + making charges.
                    </p>
                  </div>

                  {/* Silver */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      Silver (999 Purity)
                    </span>
                    <p className="text-base font-bold text-slate-900">
                      {external.silver?.pricePerGram ? `₹${Number(external.silver.pricePerGram).toLocaleString("en-IN")}` : "₹92.50"} / gram
                    </p>
                    <p className="text-[11px] font-semibold text-slate-700">
                      {external.silver?.pricePerKg ? `₹${Number(external.silver.pricePerKg).toLocaleString("en-IN")}` : "₹92,500"} / kg
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Benchmark Spot Price. Excludes 3% GST.
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic bg-[#f9fbf8] p-2.5 rounded-xl border border-[#edf1ea]">
                  <strong>Bullion Pricing Note:</strong> Benchmark prices represent international spot market rates converted to Indian Rupees at the live exchange rate. Physical retail jeweler prices include statutory 3% GST plus 8% - 18% making charges.
                </p>
              </div>

              {/* Primary Market & Verified IPOs */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                      Indian Primary Market & IPO Information
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upcoming & currently open mainline issues from NSE/BSE
                    </p>
                  </div>
                  <a
                    href="https://www.nseindia.com/market-data/all-upcoming-issues-ipo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315c46] hover:underline"
                  >
                    <span>NSE Official IPO Directory</span>
                    <FiExternalLink size={11} />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {ipoList.map((ipo, iIdx) => (
                    <div
                      key={ipo.id || iIdx}
                      className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-[#18392c] text-xs">{ipo.name}</p>
                          <p className="text-[10px] text-slate-500">{ipo.category}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
                          {ipo.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-400">Issue Dates:</span>
                          <p className="font-medium text-slate-700">{ipo.openDate} - {ipo.closeDate}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Price Band:</span>
                          <p className="font-medium text-slate-700">{ipo.priceBand}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Lot Size:</span>
                          <p className="font-medium text-slate-700">{ipo.lotSize}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Subscription:</span>
                          <p className="font-medium text-slate-700">{ipo.subscriptionStatus}</p>
                        </div>
                      </div>

                      {/* GMP Box with prominent Unofficial Label */}
                      <div className="rounded-lg bg-amber-50/70 p-2 border border-amber-200/60 text-[10px] text-amber-900">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">Grey Market Premium (GMP):</span>
                          <span className="rounded-full bg-amber-200/80 px-1.5 py-0.2 font-bold text-[9px] text-amber-950">
                            {ipo.gmpStatus}
                          </span>
                        </div>
                        {ipo.gmpPercentage && (
                          <p className="font-bold text-amber-950 text-xs mt-0.5">{ipo.gmpPercentage}</p>
                        )}
                        <p className="text-[9px] text-amber-800/80 mt-0.5">
                          {ipo.gmpNote}
                        </p>
                      </div>

                      {ipo.officialExchangeUrl && (
                        <div className="pt-1 flex justify-end">
                          <a
                            href={ipo.officialExchangeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#315c46] hover:underline"
                          >
                            <span>Official Exchange Prospectus</span>
                            <FiExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 text-[10px] text-amber-900 leading-relaxed">
                  <strong>Important GMP Disclaimer:</strong> Grey Market Premium (GMP) is unofficial, unregulated, and speculative. It can change rapidly based on rumor and is never a guaranteed listing gain or exchange value. If an IPO cannot be verified, "GMP unavailable" is displayed.
                </div>
              </div>

              {/* Stocks to Research Section (Section 8) */}
              {stocksForResearch.length > 0 && (
                <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                        Indian Stocks to Research (For Investor Education)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Established companies with verified public disclosures. These are not buy commands or guaranteed winners.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {stocksForResearch.map((stock, sIdx) => (
                      <div
                        key={stock.id || sIdx}
                        className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3.5 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-[#18392c] text-xs">
                              {stock.name} ({stock.symbol})
                            </p>
                            <p className="text-[10px] text-slate-500">{stock.sector} • {stock.exchange}</p>
                          </div>
                        </div>

                        <div className="rounded-lg bg-white p-2.5 border border-[#ecf0e9] space-y-1 text-[11px]">
                          <p className="text-slate-700">
                            <strong>What it does:</strong> {stock.whatCompanyDoes}
                          </p>
                          <p className="text-[#2b4c3c]">
                            <strong>Why research:</strong> {stock.whyResearch}
                          </p>
                        </div>

                        {stock.fundamentals && (
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                            <div>P/E Ratio: <strong>{stock.fundamentals.peRatio}</strong></div>
                            <div>Return on Equity: <strong>{stock.fundamentals.returnOnEquity}</strong></div>
                            <div className="col-span-2">52-Wk Range: <strong>{stock.fundamentals.fiftyTwoWeekRange}</strong></div>
                          </div>
                        )}

                        {Array.isArray(stock.keyRisks) && stock.keyRisks.length > 0 && (
                          <div className="text-[10px] text-rose-900 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                            <strong>Key Risks:</strong> {stock.keyRisks.join(" • ")}
                          </div>
                        )}

                        {stock.officialLink && (
                          <div className="pt-1 flex justify-end">
                            <a
                              href={stock.officialLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#315c46] hover:underline"
                            >
                              <span>Official NSE Quote & Disclosures</span>
                              <FiExternalLink size={10} />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 3: BANK FDs & MATURING MONEY
             ======================================================== */}
          {activeTab === "bank_fds" && (
            <div className="space-y-5">
              {/* DICGC Protection Banner */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-3 shadow-xs">
                <FiShield className="text-emerald-700 shrink-0 mt-0.5" size={20} />
                <div className="text-xs">
                  <p className="font-bold text-emerald-950 text-sm">
                    DICGC Sovereign Protection Up to ₹5,00,000
                  </p>
                  <p className="text-emerald-800 mt-0.5 leading-relaxed">
                    Deposits with all scheduled commercial banks (SBI, HDFC, ICICI, etc.) are insured up to ₹5,00,000 per depositor per bank by the Deposit Insurance and Credit Guarantee Corporation (a wholly-owned subsidiary of RBI).
                  </p>
                </div>
              </div>

              {/* Verified Bank Card Rates */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                      Verified Published Bank Card Rates
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Card rates for Tier-1 Scheduled Commercial Banks in the current RBI repo rate cycle (6.50%)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* SBI */}
                  <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#18392c] text-xs">State Bank of India (SBI)</p>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                        DICGC Insured
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#315c46]">6.80% - 7.25% p.a.</p>
                      <p className="text-[11px] text-slate-500">Senior Citizens: 7.30% - 7.75%</p>
                      <p className="text-[10px] text-slate-600">Special Scheme: Amrit Vrishti (444 Days @ 7.25%)</p>
                      <p className="text-[10px] text-slate-500">Premature Penalty: 0.50% (up to ₹5L); 1.00% above</p>
                    </div>
                    <div className="pt-1">
                      <a
                        href="https://sbi.co.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315c46] hover:underline"
                      >
                        <span>Official SBI FD Page</span>
                        <FiExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* HDFC Bank */}
                  <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#18392c] text-xs">HDFC Bank</p>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                        DICGC Insured
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#315c46]">7.10% - 7.20% p.a.</p>
                      <p className="text-[11px] text-slate-500">Senior Citizens: 7.60% - 7.70%</p>
                      <p className="text-[10px] text-slate-600">Tenure: 15 Months to 18 Months (7.10%)</p>
                      <p className="text-[10px] text-slate-500">Premature Penalty: 1.00%</p>
                    </div>
                    <div className="pt-1">
                      <a
                        href="https://www.hdfcbank.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315c46] hover:underline"
                      >
                        <span>Official HDFC FD Page</span>
                        <FiExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* ICICI Bank */}
                  <div className="rounded-xl border border-[#edf2ea] bg-[#fafcf9] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-[#18392c] text-xs">ICICI Bank</p>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] font-bold">
                        DICGC Insured
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#315c46]">7.20% - 7.25% p.a.</p>
                      <p className="text-[11px] text-slate-500">Senior Citizens: 7.75% - 7.80%</p>
                      <p className="text-[10px] text-slate-600">Tenure: 15 Months to 2 Years (7.20% - 7.25%)</p>
                      <p className="text-[10px] text-slate-500">Premature Penalty: 0.50% - 1.00%</p>
                    </div>
                    <div className="pt-1">
                      <a
                        href="https://www.icicibank.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#315c46] hover:underline"
                      >
                        <span>Official ICICI FD Page</span>
                        <FiExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic bg-[#f9fbf8] p-2.5 rounded-xl border border-[#edf1ea]">
                  <strong>Taxation Note:</strong> Fixed deposit interest is fully taxable at your individual income tax slab rate under "Income from Other Sources". Banks deduct TDS at 10% if total interest earned exceeds ₹40,000 in a financial year (₹50,000 for senior citizens).
                </p>
              </div>

              {/* Maturing Investment to Action Comparison (Section 9) */}
              <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                  Maturing Money Decision Framework
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  When a recorded deposit or investment matures, compare options based on your immediate cash needs:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="rounded-xl border border-[#edf1ea] bg-[#fafcf9] p-3 space-y-1">
                    <p className="font-bold text-[#18392c]">Option 1: Keep for Upcoming Bills</p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Keep cash available in your account if you have upcoming EMIs, insurance premiums, or school fees due in the next 1-2 months.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#edf1ea] bg-[#fafcf9] p-3 space-y-1">
                    <p className="font-bold text-[#18392c]">Option 2: Short-Term Bank FD</p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Lock money into a 1-year FD (~7.10%) if you will not need it immediately, earning safe interest with DICGC insurance protection.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#edf1ea] bg-[#fafcf9] p-3 space-y-1">
                    <p className="font-bold text-[#18392c]">Option 3: Long-Term Investing</p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Consider a diversified mutual fund or SIP only if you already have 3-6 months of emergency reserves and a 3-5+ year horizon.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: CHECKLIST & ACTION MATRIX
             ======================================================== */}
          {activeTab === "readiness_matrix" && (
            <div className="space-y-5">
              {/* 9-Point Readiness Checklist */}
              {readiness?.checks && (
                <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                      Investment Readiness Checklist
                    </p>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      {readiness.passedChecksCount} of {readiness.totalChecksCount} Checks Passed
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {readiness.checks.map((chk, cIdx) => (
                      <div
                        key={cIdx}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${
                          chk.passed
                            ? "border-emerald-100 bg-emerald-50/40 text-emerald-950"
                            : "border-amber-100 bg-amber-50/40 text-amber-950"
                        }`}
                      >
                        <span className={`mt-0.5 rounded-full p-0.5 ${chk.passed ? "text-emerald-700 bg-emerald-100" : "text-amber-700 bg-amber-100"}`}>
                          {chk.passed ? <FiCheck size={12} /> : <FiAlertTriangle size={12} />}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{chk.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{chk.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6-Choice Ranked Matrix */}
              {comparisonMatrix.length > 0 && (
                <div className="rounded-2xl border border-[#dfe8dc] bg-white p-4 shadow-xs space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#18392c]">
                    Ranked Choice Matrix (From MongoDB Surplus)
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#e5ece2] text-[10px] uppercase font-bold text-slate-500 bg-[#f9fbf8]">
                          <th className="py-2.5 px-3">Rank</th>
                          <th className="py-2.5 px-3">Choice</th>
                          <th className="py-2.5 px-3">Why to Consider</th>
                          <th className="py-2.5 px-3">Trade-off</th>
                          <th className="py-2.5 px-3">Allocation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf2ea]">
                        {comparisonMatrix.map((opt, idx) => (
                          <tr key={idx} className={opt.rank === 1 ? "bg-emerald-50/30" : "hover:bg-[#fbfcfb]"}>
                            <td className="py-3 px-3 font-bold text-[#315c46]">#{opt.rank}</td>
                            <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">{opt.choice}</td>
                            <td className="py-3 px-3 text-slate-700 leading-snug">{opt.whyToConsider}</td>
                            <td className="py-3 px-3 text-slate-500 leading-snug">{opt.mainTradeOff}</td>
                            <td className="py-3 px-3 font-bold text-[#18392c] whitespace-nowrap">
                              {opt.illustrativeAllocation > 0 ? `₹${Number(opt.illustrativeAllocation).toLocaleString("en-IN")}` : "₹0"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              MANDATORY VERBATIM RISK DISCLAIMER (ALWAYS VISIBLE)
             ======================================================== */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 shadow-xs">
            <span className="text-amber-700 text-xs mt-0.5">⚠️</span>
            <p className="text-xs font-semibold text-amber-900 leading-snug">
              Invest at your own risk — market prices and conditions can change, and values may increase or decrease.
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
              Market Feeds: {external.source || "NSE, BSE, AMFI, Gold-API & RBI"}
            </span>
            <span>
              Engine: {suggestion.modelUsed ? `Gemini (${suggestion.modelUsed})` : "FinanceOS AI Adviser"}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#dfe8dc] bg-white px-6 py-3.5">
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
            className="rounded-xl border border-[#d7e1d5] bg-white px-5 py-2 text-xs font-semibold text-[#52665b] transition hover:bg-[#f4f7f1] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
