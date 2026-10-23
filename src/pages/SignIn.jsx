import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import useFinance from "../context/useFinance.js";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Mail,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import CenteredModal from "../components/common/CenteredModal.jsx";
import { setAuthSession } from "../utils/authStorage.js";

function SignIn() {
  const { setUserData } = useFinance();
  const navigate = useNavigate();

  // ==========================================================
  // STATE
  // ==========================================================

  const [otpMode, setOtpMode] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);

  const otpRefs = useRef([]);
  const isSendingRef = useRef(false);

  const otp = otpDigits.join("");

  const [otpTimer, setOtpTimer] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const [loginError, setLoginError] = useState("");
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [otpNotice, setOtpNotice] = useState("");
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    title: "Authentication Notice",
    message: "",
    iconType: "info",
  });
  const [accountNotFoundModal, setAccountNotFoundModal] = useState({
    isOpen: false,
    message: "",
  });

  const [formData, setFormData] = useState({
    email: "",
    rememberMe: true,
  });

  // ==========================================================
  // GOOGLE IDENTITY SERVICES INITIALIZATION
  // ==========================================================

  useEffect(() => {
    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (typeof window !== "undefined" && window.__GOOGLE_CLIENT_ID__);

    // Load Google Identity Services script if not already present
    const scriptId = "google-gsi-client-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (googleClientId && window.google?.accounts?.id) {
          try {
            window.google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response) => {
                if (response?.credential) {
                  completeGoogleSignIn({ credential: response.credential });
                }
              },
              auto_select: false,
              cancel_on_tap_outside: true,
            });
          } catch (initErr) {
            console.warn("[AUTH] GSI initialization warning:", initErr);
          }
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  // ==========================================================
  // COMPLETE GOOGLE SIGN IN
  // ==========================================================

  const completeGoogleSignIn = async (payload) => {
    try {
      setIsGoogleSubmitting(true);
      setLoginError("");

      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          intent: "signin",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404 || data.code === "ACCOUNT_NOT_FOUND") {
          setAccountNotFoundModal({
            isOpen: true,
            message:
              data.message ||
              "No FinanceOS account was found for this Google account. Please register first.",
          });
          return;
        }
        const errorMsg =
          data.message || "Google Sign-In could not be completed. Please try again.";
        setAuthModal({
          isOpen: true,
          title: "Google Sign-In",
          message: errorMsg,
          iconType: "error",
        });
        return;
      }

      if (!data.token || !data.user) {
        setAuthModal({
          isOpen: true,
          title: "Google Sign-In",
          message: "Google Sign-In could not be completed. Please try again.",
          iconType: "error",
        });
        return;
      }

      // Store tokens in tab-isolated sessionStorage
      setAuthSession(data.token, data.user);
      setUserData(data.user);

      if (data.user.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("[AUTH] Google sign in error:", error);
      setAuthModal({
        isOpen: true,
        title: "Google Sign-In",
        message: "Google Sign-In could not be completed. Please try again.",
        iconType: "error",
      });
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // ==========================================================
  // HANDLE GOOGLE SIGN IN CLICK
  // ==========================================================

  const handleGoogleSignIn = () => {
    setLoginError("");

    const googleClientId =
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (typeof window !== "undefined" && window.__GOOGLE_CLIENT_ID__);

    if (!googleClientId) {
      console.warn("[AUTH] VITE_GOOGLE_CLIENT_ID is not configured in environment.");
      setAuthModal({
        isOpen: true,
        title: "Google Sign-In",
        message: "Google Sign-In could not be completed. Please try again.",
        iconType: "error",
      });
      return;
    }

    if (!window.google?.accounts) {
      setAuthModal({
        isOpen: true,
        title: "Google Sign-In",
        message: "Google authentication service is still loading. Please try again in a moment.",
        iconType: "info",
      });
      return;
    }

    setIsGoogleSubmitting(true);

    try {
      // Use standard Google OAuth2 Token Client for popup account selector
      if (window.google.accounts.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "openid email profile",
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              await completeGoogleSignIn({
                accessToken: tokenResponse.access_token,
              });
            } else {
              setIsGoogleSubmitting(false);
            }
          },
          error_callback: (err) => {
            console.error("[AUTH] Google OAuth popup error:", err);
            setIsGoogleSubmitting(false);
            setAuthModal({
              isOpen: true,
              title: "Google Sign-In",
              message: "Google Sign-In could not be completed. Please try again.",
              iconType: "error",
            });
          },
        });
        tokenClient.requestAccessToken();
      } else if (window.google.accounts.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response?.credential) {
              completeGoogleSignIn({ credential: response.credential });
            } else {
              setIsGoogleSubmitting(false);
            }
          },
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleSubmitting(false);
          }
        });
      }
    } catch (err) {
      console.error("[AUTH] Google sign in trigger error:", err);
      setIsGoogleSubmitting(false);
      setAuthModal({
        isOpen: true,
        title: "Google Sign-In",
        message: "Google Sign-In could not be completed. Please try again.",
        iconType: "error",
      });
    }
  };

  // ==========================================================
  // AUTO FOCUS FIRST OTP BOX WHEN OTP MODE OPENS
  // ==========================================================

  useEffect(() => {
    if (otpMode) {
      const timer = setTimeout(() => {
        const firstEmpty = otpDigits.findIndex((d) => !d);
        const targetIdx = firstEmpty !== -1 ? firstEmpty : 0;
        otpRefs.current[targetIdx]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [otpMode]);

  // ==========================================================
  // OTP INPUT HANDLERS (6 INDIVIDUAL BOXES)
  // ==========================================================

  const handleOtpChange = (index, e) => {
    const rawValue = e.target.value;
    const digitsOnly = rawValue.replace(/\D/g, "");

    // If empty / cleared
    if (!digitsOnly) {
      const updated = [...otpDigits];
      updated[index] = "";
      setOtpDigits(updated);
      setLoginError("");
      return;
    }

    // If multiple digits were pasted/autofilled into a single box
    if (digitsOnly.length > 1) {
      const updated = [...otpDigits];
      let pasteIdx = index;
      for (let i = 0; i < digitsOnly.length && pasteIdx < 6; i++) {
        updated[pasteIdx] = digitsOnly[i];
        pasteIdx++;
      }
      setOtpDigits(updated);
      setLoginError("");

      const nextFocus = Math.min(pasteIdx, 5);
      otpRefs.current[nextFocus]?.focus();
      return;
    }

    // Exactly 1 digit entered
    const updated = [...otpDigits];
    updated[index] = digitsOnly.slice(-1);
    setOtpDigits(updated);
    setLoginError("");

    // Automatically move focus to next box
    if (index < 5) {
      setTimeout(() => {
        otpRefs.current[index + 1]?.focus();
      }, 10);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        // Clear current box digit
        const updated = [...otpDigits];
        updated[index] = "";
        setOtpDigits(updated);
        setLoginError("");
      } else if (index > 0) {
        // Move to previous box and clear its digit
        const updated = [...otpDigits];
        updated[index - 1] = "";
        setOtpDigits(updated);
        setLoginError("");
        setTimeout(() => {
          otpRefs.current[index - 1]?.focus();
        }, 10);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      setTimeout(() => {
        otpRefs.current[index - 1]?.focus();
      }, 10);
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      setTimeout(() => {
        otpRefs.current[index + 1]?.focus();
      }, 10);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData ? e.clipboardData.getData("text") : "";
    const cleanDigits = pasteData.replace(/\D/g, "").slice(0, 6);
    if (!cleanDigits) return;

    const updated = ["", "", "", "", "", ""];
    for (let i = 0; i < cleanDigits.length; i++) {
      updated[i] = cleanDigits[i];
    }
    setOtpDigits(updated);
    setLoginError("");

    const nextFocus = Math.min(cleanDigits.length, 5);
    setTimeout(() => {
      otpRefs.current[nextFocus]?.focus();
    }, 10);
  };

  // ==========================================================
  // OTP TIMER
  // ==========================================================

  useEffect(() => {
    if (otpTimer <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setOtpTimer((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [otpTimer]);

  // ==========================================================
  // INPUT CHANGE
  // ==========================================================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((previous) => ({
      ...previous,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setLoginError("");
    setAccountNotFound(false);
  };

  // ==========================================================
  // START OTP TIMER
  // ==========================================================

  const startOtpTimer = () => {
    setOtpTimer(300);
  };

  // ==========================================================
  // SEND OTP
  // ==========================================================

  const handleSendOTP = async () => {
    if (isSendingRef.current || isSubmitting) {
      return;
    }

    setLoginError("");

    const email =
      formData.email
        .trim()
        .toLowerCase();

    // ========================================================
    // EMAIL REQUIRED
    // ========================================================

    if (!email) {
      setLoginError(
        "Please enter your email address."
      );

      return;
    }

    // ========================================================
    // EMAIL VALIDATION
    // ========================================================

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      setLoginError(
        "Please enter a valid email address."
      );

      return;
    }

    try {
      isSendingRef.current = true;
      setIsSubmitting(true);

      // ======================================================
      // SEND OTP REQUEST
      // ======================================================

      const response = await fetch(
        "/api/auth/send-otp",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (response.status === 404 || data.code === "ACCOUNT_NOT_FOUND") {
          setAccountNotFound(true);
          const errorMsg =
            data.message ||
            "No account found for this email address. Please register first.";
          setLoginError(errorMsg);
          setAccountNotFoundModal({
            isOpen: true,
            message: errorMsg,
          });
        } else if (response.status === 429) {
          setLoginError(
            data.message ||
              "Please wait before requesting another OTP."
          );
        } else if (response.status === 400) {
          setLoginError(
            data.message ||
              "Please enter a valid email address."
          );
        } else if (data.code === "EMAIL_DELIVERY_FAILED" || response.status === 500) {
          const errorMsg =
            "We couldn't send the verification code. Please check your email service configuration and try again.";
          setLoginError(errorMsg);
          setAuthModal({
            isOpen: true,
            title: "Email Delivery Failed",
            message: errorMsg,
            iconType: "error",
          });
        } else {
          setLoginError(
            data.message ||
              "Unable to send OTP right now. Please try again."
          );
        }

        return;
      }

      // ======================================================
      // CHECK EMAIL DISPATCH SUCCESS
      // ======================================================

      if (data.emailSent === false) {
        const errorMsg =
          "We couldn't send the verification code. Please check your email service configuration and try again.";
        setLoginError(errorMsg);
        setAuthModal({
          isOpen: true,
          title: "Email Delivery Failed",
          message: errorMsg,
          iconType: "error",
        });
        return;
      }

      // ======================================================
      // OTP SUCCESS
      // ======================================================

      setFormData((previous) => ({
        ...previous,
        email,
      }));

      setOtpMode(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpNotice("");
      startOtpTimer();

    } catch (error) {
      console.error(
        "Send OTP Error:",
        error
      );

      setLoginError(
        "Unable to connect to the FinanceOS server. Please check your connection."
      );

    } finally {
      isSendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ==========================================================
  // VERIFY OTP
  // ==========================================================

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    setLoginError("");

    // ========================================================
    // OTP VALIDATION
    // ========================================================

    if (otp.length !== 6) {
      setLoginError(
        "Please enter the 6-digit OTP."
      );

      return;
    }

    const email =
      formData.email
        .trim()
        .toLowerCase();

    try {
      setIsSubmitting(true);

      // ======================================================
      // VERIFY OTP REQUEST
      // ======================================================

      const response = await fetch(
        "/api/auth/verify-otp",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

      const data =
        await response.json();

      console.log(
        "Verify OTP Response:",
        data
      );

      // ======================================================
      // BACKEND ERROR
      // ======================================================

      if (!response.ok) {
        if (response.status === 404) {
          setLoginError(
            data.message ||
              "Authentication service endpoint is unavailable."
          );
        } else if (response.status === 401) {
          setLoginError(
            data.message ||
              "Invalid or expired OTP. Please try again."
          );
        } else {
          setLoginError(
            data.message ||
              "Unable to verify OTP right now."
          );
        }

        return;
      }

      // ======================================================
      // CHECK SERVER RESPONSE
      // ======================================================

      if (
        !data.token ||
        !data.user
      ) {
        setLoginError(
          "Invalid response received from server."
        );

        return;
      }

      // ======================================================
      // TAB-ISOLATED SESSION STORAGE
      // ======================================================

      setAuthSession(data.token, data.user);
      setUserData(data.user);

      // ======================================================
      // ROLE BASED REDIRECTION
      // ======================================================

      console.log(
        "Logged in user:",
        data.user
      );

      console.log(
        "User role:",
        data.user.role
      );

      // ======================================================
      // ADMIN
      // ======================================================

      if (
        data.user.role === "admin"
      ) {
        console.log(
          "Admin detected → Admin Dashboard"
        );

        navigate(
          "/admin/dashboard",
          {
            replace: true,
          }
        );

        return;
      }

      // ======================================================
      // NORMAL USER
      // ======================================================

      console.log(
        "User detected → User Dashboard"
      );

      navigate(
        "/dashboard",
        {
          replace: true,
        }
      );

    } catch (error) {
      console.error(
        "Verify OTP Error:",
        error
      );

      setLoginError(
        "Unable to connect to the FinanceOS server."
      );

    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================
  // RESEND OTP
  // ==========================================================

  const handleResendOTP = async () => {
    if (
      otpTimer > 0 ||
      isSubmitting
    ) {
      return;
    }

    await handleSendOTP();
  };

  // ==========================================================
  // CHANGE EMAIL
  // ==========================================================

  const handleChangeEmail = () => {
    setOtpMode(false);

    setOtpDigits(["", "", "", "", "", ""]);

    setOtpTimer(0);

    setLoginError("");
    setOtpNotice("");
  };

  // ==========================================================
  // FORMAT TIMER
  // ==========================================================

  const formatTimer = () => {
    const minutes =
      Math.floor(
        otpTimer / 60
      );

    const seconds =
      otpTimer % 60;

    return `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="h-screen overflow-hidden bg-[#f7f9f4] text-[#173b2b]">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="h-[64px] border-b border-[#e1e7dc] bg-white">

        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6 lg:px-8">

          {/* LOGO */}

          <Link
            to="/"
            className="flex items-center gap-3"
          >

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf7df]">

              <TrendingUp
                size={20}
                className="text-[#4f8d32]"
              />

            </div>

            <div>

              <p className="text-xl font-bold tracking-tight text-[#43822e]">
                FinanceOS
              </p>

              <p className="text-[8px] font-medium tracking-wide text-[#6f846e]">
                Manage Today, Secure Tomorrow
              </p>

            </div>

          </Link>

          {/* BACK HOME */}

          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-[#617268] transition hover:text-[#43822e]"
          >

            <ArrowLeft size={16} />

            Back to Home

          </Link>

        </div>

      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main className="h-[calc(100vh-64px)] p-3 lg:p-4">

        <div
          className="
            mx-auto
            grid
            h-full
            w-full
            max-w-6xl
            overflow-hidden
            rounded-[26px]
            border
            border-[#dfe6da]
            bg-white
            shadow-[0_15px_45px_rgba(50,80,55,0.07)]
            lg:grid-cols-[0.95fr_1.05fr]
          "
        >

          {/* ==================================================
              LEFT PANEL
          ================================================== */}

          <section
            className="
              relative
              hidden
              h-full
              overflow-hidden
              bg-[#edf5e8]
              p-7
              lg:flex
              lg:flex-col
            "
          >

            <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#dcefc2]/60" />

            <div className="absolute -bottom-36 -right-24 h-80 w-80 rounded-full bg-[#dcefc2]/60" />

            <div className="relative z-10">

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#67964f]">
                FinanceOS
              </p>

              <h1 className="mt-3 text-3xl font-bold leading-tight text-[#173b2b]">

                Your finances.

                <span className="block text-[#57923d]">
                  One connected system.
                </span>

              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-[#65786d]">
                Bring the important parts of your
                financial life together and understand
                how they connect.
              </p>

            </div>

            {/* SECURITY CARD */}

            <div className="relative z-10 mt-5">

              <div className="rounded-[22px] border border-[#d7e3d0] bg-white/85 p-5 shadow-sm">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f3d8]">

                    <ShieldCheck
                      size={22}
                      className="text-[#57923d]"
                    />

                  </div>

                  <div>

                    <p className="font-semibold text-[#173b2b]">
                      Secure Login
                    </p>

                    <p className="text-xs text-[#7a897f]">
                      OTP protected access
                    </p>

                  </div>

                </div>

                <div className="my-4 h-px bg-[#e1e7dd]" />

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf5e8]">

                    <Mail
                      size={17}
                      className="text-[#57923d]"
                    />

                  </div>

                  <div>

                    <p className="text-sm font-semibold">
                      Email Verification
                    </p>

                    <p className="text-xs text-[#7b8a80]">
                      Receive a secure OTP
                    </p>

                  </div>

                </div>

                <div className="mx-auto ml-[17px] h-5 w-px bg-[#ccd9c4]" />

                <div className="flex items-center gap-3">

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf5e8]">

                    <ShieldCheck
                      size={17}
                      className="text-[#57923d]"
                    />

                  </div>

                  <div>

                    <p className="text-sm font-semibold">
                      Automatic Role Access
                    </p>

                    <p className="text-xs text-[#7b8a80]">
                      Admin or User dashboard
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* ==================================================
              RIGHT PANEL
          ================================================== */}

          <section className="h-full overflow-hidden px-7 py-5 lg:px-10">

            <div className="mx-auto flex h-full w-full max-w-[560px] flex-col justify-center">

              {/* HEADER */}

              <div>

                <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#669451]">
                  Secure Access
                </p>

                <h2 className="mt-2 text-3xl font-bold leading-tight text-[#173b2b]">
                  Welcome Back
                </h2>

                <p className="mt-1.5 text-sm text-[#718177]">

                  {otpMode
                    ? "Enter the OTP sent to your email."
                    : "Sign in securely using email verification."}

                </p>

              </div>

              {/* ==================================================
                  CONTINUE WITH GOOGLE & EMAIL
              ================================================== */}

              {!otpMode && (
                <div className="mt-6 space-y-4">

                  {/* EMAIL INPUT */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-sm font-semibold text-[#344f42]"
                    >
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#87958c]"
                      />

                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email"
                        autoComplete="email"
                        className="
                          w-full
                          rounded-xl
                          border
                          border-[#dce3d8]
                          bg-[#fbfcfa]
                          py-3
                          pl-11
                          pr-4
                          text-sm
                          text-[#173b2b]
                          outline-none
                          focus:border-[#9fbd82]
                          focus:ring-2
                          focus:ring-[#eaf4df]
                        "
                      />
                    </div>
                  </div>



                  {/* ERROR MESSAGE */}
                  {loginError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5">
                      <AlertCircle
                        size={17}
                        className="mt-0.5 shrink-0 text-red-500"
                      />
                      <div className="flex-1 text-xs font-medium leading-5 text-red-700">
                        <p>{loginError}</p>
                        {accountNotFound && (
                          <div className="mt-2 pt-2 border-t border-red-200/80">
                            <Link
                              to="/signup"
                              state={{ initialEmail: formData.email }}
                              className="inline-flex items-center gap-1 font-bold text-[#356d25] hover:underline"
                            >
                              Create your FinanceOS account now →
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEND OTP BUTTON */}
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={isSubmitting || isGoogleSubmitting}
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-[#dff5b5]
                      px-6
                      py-3
                      text-sm
                      font-semibold
                      text-[#173b2b]
                      transition
                      hover:bg-[#d2efa0]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {isSubmitting ? "Sending OTP..." : "Send OTP"}
                    {!isSubmitting && <Mail size={17} />}
                  </button>

                  {/* DIVIDER */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-[#e1e7dc]" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#829589]">
                      or
                    </span>
                    <div className="h-px flex-1 bg-[#e1e7dc]" />
                  </div>

                  {/* GOOGLE SIGN IN BUTTON */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting || isGoogleSubmitting}
                    className="
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-3
                      rounded-xl
                      border
                      border-[#d8e0d4]
                      bg-white
                      px-5
                      py-3
                      text-sm
                      font-semibold
                      text-[#1f3f30]
                      shadow-sm
                      transition-all
                      duration-150
                      hover:bg-[#f4f8f0]
                      hover:border-[#adc7a4]
                      hover:shadow
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {isGoogleSubmitting ? (
                      <RefreshCw size={18} className="animate-spin text-[#57923d]" />
                    ) : (
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.39 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.61 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                    )}
                    <span>
                      {isGoogleSubmitting
                        ? "Connecting..."
                        : "Continue with Google"}
                    </span>
                  </button>

                </div>
              )}

              {/* ==================================================
                  OTP VERIFICATION FORM
              ================================================== */}

              {otpMode && (
                <form onSubmit={handleVerifyOTP} className="mt-6">
                  <div className="rounded-2xl border border-[#dce7d5] bg-[#f8fbf5] p-5">
                    {/* OTP HEADER */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f3d8]">
                        <ShieldCheck size={21} className="text-[#57923d]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#173b2b]">
                          Verify Your Email
                        </p>
                        <p className="text-xs text-[#718177]">
                          OTP sent to <strong>{formData.email}</strong>
                        </p>
                      </div>
                    </div>

                    {/* 6 INDIVIDUAL OTP INPUT BOXES */}
                    <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpRefs.current[idx] = el)}
                          id={`otp-box-${idx}`}
                          name={`otp-box-${idx}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          autoComplete={idx === 0 ? "one-time-code" : "off"}
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          onFocus={(e) => e.target.select()}
                          disabled={isSubmitting}
                          aria-label={`Digit ${idx + 1} of 6-digit OTP`}
                          className="
                            h-12 w-11 sm:h-14 sm:w-13 md:h-14 md:w-14
                            rounded-xl border border-[#dce3d8] bg-white
                            text-center text-xl sm:text-2xl font-bold text-[#173b2b]
                            outline-none transition-all duration-150
                            focus:border-[#57923d] focus:ring-2 focus:ring-[#eaf4df]
                            disabled:cursor-not-allowed disabled:bg-[#f5f7f3] disabled:text-[#8d9b92]
                            shadow-sm
                          "
                        />
                      ))}
                    </div>

                    {/* TIMER */}
                    <div className="mt-3 text-center">
                      {otpTimer > 0 ? (
                        <p className="text-xs text-[#718177]">
                          OTP expires in{" "}
                          <strong className="text-[#57923d]">{formatTimer()}</strong>
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57923d] hover:underline"
                        >
                          <RefreshCw size={13} />
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ERROR */}
                  {loginError && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                      <p className="text-xs font-medium leading-5 text-red-600">
                        {loginError}
                      </p>
                    </div>
                  )}

                  {/* VERIFY BUTTON */}
                  <button
                    type="submit"
                    disabled={isSubmitting || otp.length !== 6}
                    className="
                      mt-4
                      flex
                      w-full
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-[#dff5b5]
                      px-6
                      py-3
                      text-sm
                      font-semibold
                      text-[#173b2b]
                      transition
                      hover:bg-[#d2efa0]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {isSubmitting ? "Verifying..." : "Verify OTP"}
                    {!isSubmitting && <ArrowRight size={17} />}
                  </button>

                  {/* CHANGE EMAIL */}
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    className="mt-3 w-full text-center text-xs font-semibold text-[#57923d] hover:underline"
                  >
                    ← Change Email
                  </button>
                </form>
              )}

              {/* ==================================================
                  CREATE ACCOUNT
              ================================================== */}

              <div className="mt-5 border-t border-[#e7ebe4] pt-4 text-center">

                <p className="text-sm text-[#718177]">

                  Don't have a FinanceOS account?{" "}

                  <Link
                    to="/signup"
                    className="font-semibold text-[#57923d]"
                  >
                    Create Account
                  </Link>

                </p>

              </div>

            </div>

          </section>

        </div>

      </main>

      <CenteredModal
        isOpen={authModal.isOpen}
        onClose={() => setAuthModal((prev) => ({ ...prev, isOpen: false }))}
        title={authModal.title}
        message={authModal.message}
        iconType={authModal.iconType}
        confirmText="OK"
      />

      <CenteredModal
        isOpen={accountNotFoundModal.isOpen}
        onClose={() => setAccountNotFoundModal({ isOpen: false, message: "" })}
        title="Account Not Found"
        message={accountNotFoundModal.message}
        type="confirm"
        iconType="info"
        confirmText="Register"
        cancelText="Cancel"
        onConfirm={() => {
          setAccountNotFoundModal({ isOpen: false, message: "" });
          navigate("/signup");
        }}
      />
    </div>
  );
}

export default SignIn;