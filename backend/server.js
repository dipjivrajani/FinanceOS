// ============================================================
// FINANCEOS - BACKEND SERVER
// ============================================================

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { initSocket } = require("./services/socketService");
const { startMarketBroadcastTimer } = require("./services/marketDataService");

dotenv.config({ path: path.resolve(__dirname, ".env") });

// ============================================================
// EXPRESS
// ============================================================

const app = express();
let smtpVerifiedState = false;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// ============================================================
// ROUTES
// ============================================================

const authRoutes =
  require("./routes/authRoutes");

const adminRoutes =
  require("./routes/adminRoutes");

const monthlyFinanceRoutes =
  require("./routes/monthlyFinanceRoutes");

const additionalIncomeRoutes =
  require("./routes/additionalIncomeRoutes");

const savingGoalRoutes =
  require("./routes/savingGoalRoutes");

const investmentRoutes =
  require("./routes/investmentRoutes");

const reminderRoutes =
  require("./routes/reminderRoutes");

const userReminderRoutes =
  require("./routes/userReminderRoutes");

const liabilityRoutes = require("./routes/liabilityRoutes");
const insuranceRoutes = require("./routes/insuranceRoutes");
const messageRoutes = require("./routes/messageRoutes");
const aiRoutes = require("./routes/aiRoutes");
const reportRoutes = require("./routes/reportRoutes");

// ============================================================
// AUTH
// ============================================================

app.use(
  "/api/auth",
  authRoutes
);

// ============================================================
// ADMIN
// ============================================================

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/admin/reminders",
  reminderRoutes
);

// ============================================================
// FINANCE
// ============================================================

app.use(
  "/api/monthly-finance",
  monthlyFinanceRoutes
);

app.use(
  "/api/additional-income",
  additionalIncomeRoutes
);

app.use(
  "/api/saving-goals",
  savingGoalRoutes
);

app.use(
  "/api/investments",
  investmentRoutes
);

app.use(
  "/api/reminders",
  userReminderRoutes
);

app.use(
  "/api/liabilities",
  liabilityRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

app.use(
  "/api/insurances",
  insuranceRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/reports",
  reportRoutes
);

const { startScheduler } = require("./services/schedulerService");
const { verifyTransporter } = require("./services/emailService");
const { migrateRecurringSchedules } = require("./utils/migrateDueDates");
const { cleanupLegacySmsPreferences } = require("./utils/cleanupLegacySms");

// ============================================================
// TEST
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FinanceOS Backend API is running",
  });
});


// ============================================================
// HEALTH ENDPOINT
//
// GET /api/health
//
// Safe development endpoint for exam-day troubleshooting.
// Does not expose secrets.
// ============================================================

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1
      ? "connected"
      : dbState === 2
      ? "connecting"
      : dbState === 3
      ? "disconnecting"
      : "disconnected";

  res.json({
    success: true,
    server: "ok",
    database: dbStatus,
    email: process.env.EMAIL_USER ? "configured" : "not configured",
    smtp: smtpVerifiedState ? "verified" : "unverified",
    environment: process.env.NODE_ENV || "development",
    otpTerminalMode: "disabled",
    devAuthBypass:
      process.env.NODE_ENV === "development" &&
      process.env.DEV_AUTH_BYPASS === "true"
        ? "enabled"
        : "disabled",
    uptime: Math.floor(process.uptime()) + "s",
  });
});


// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});


// ============================================================
// GLOBAL ERROR HANDLERS — BACKEND STABILITY
//
// Prevent the Node process from crashing on unhandled errors.
// These handlers log useful diagnostics without swallowing
// the error silently.
//
// IMPORTANT: These are safety nets, not substitutes for
// proper error handling in routes/controllers.
// ============================================================

process.on("uncaughtException", (error) => {
  console.error("=================================================");
  console.error("[FINANCEOS] UNCAUGHT EXCEPTION (process survived)");
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);
  console.error("=================================================");
  // Do NOT exit — keep backend running for exam stability.
  // In production you would typically exit after cleanup.
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("=================================================");
  console.error("[FINANCEOS] UNHANDLED PROMISE REJECTION (process survived)");
  console.error("Reason:", reason instanceof Error ? reason.message : reason);
  if (reason instanceof Error && reason.stack) {
    console.error("Stack:", reason.stack);
  }
  console.error("=================================================");
  // Do NOT exit — keep backend running for exam stability.
});


// ============================================================
// MONGODB CONNECTION + RESILIENCE
// ============================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log(
      "MongoDB connected successfully"
    );

    // ---------------------------------------------------------
    // MongoDB disconnect/error event handlers
    // Prevent silent connection loss from crashing the process
    // ---------------------------------------------------------

    mongoose.connection.on("error", (err) => {
      console.error(
        "[MongoDB] Connection error:",
        err.message
      );
    });

    mongoose.connection.on("disconnected", () => {
      console.warn(
        "[MongoDB] Disconnected. Mongoose will attempt to reconnect automatically."
      );
    });

    mongoose.connection.on("reconnected", () => {
      console.log(
        "[MongoDB] Reconnected successfully."
      );
    });

    // Verify SMTP configuration safely without logging secrets
    try {
      smtpVerifiedState = await verifyTransporter();
    } catch (err) {
      smtpVerifiedState = false;
      console.error("[Startup] SMTP verification failed:", err.message);
    }

    // Safely migrate any existing plans to recurring schedule model
    try {
      await migrateRecurringSchedules();
    } catch (err) {
      console.error("[Startup] Migration error:", err.message);
    }

    // Safely remove legacy SMS preference fields from existing documents without altering financial data
    try {
      await cleanupLegacySmsPreferences();
    } catch (err) {
      console.error("[Startup] SMS cleanup error:", err.message);
    }

    // Start background scheduler worker
    try {
      startScheduler();
    } catch (err) {
      console.error("[Startup] Scheduler failed to start:", err.message);
    }

    const PORT =
      process.env.PORT || 5000;

    const server = http.createServer(app);
    initSocket(server);

    // Start background market broadcast timer (publishes updated market snapshots over Socket.IO)
    try {
      startMarketBroadcastTimer(60000);
    } catch (err) {
      console.warn("[Startup] Market broadcast timer warning:", err.message);
    }

    server.listen(PORT, () => {

      // -------------------------------------------------------
      // SAFE STARTUP BANNER
      // -------------------------------------------------------

      console.log("");
      console.log("=================================================");
      console.log("FinanceOS Backend");
      console.log("-------------------------------------------------");
      console.log(`Environment:       ${process.env.NODE_ENV || "development"}`);
      console.log(`Server:            running`);
      console.log(`Port:              ${PORT}`);
      console.log(`URL:               http://localhost:${PORT}`);
      console.log(`WebSockets:        enabled (Socket.IO attached)`);
      console.log(`MongoDB:           connected`);
      console.log(`Email:             ${process.env.EMAIL_USER ? "configured" : "NOT configured"}`);
      console.log(`SMTP:              ${smtpVerifiedState ? "verified" : "FAILED / UNVERIFIED"}`);
      console.log(`Gemini AI:         ${process.env.GEMINI_API_KEY ? "configured" : "NOT configured"} (model: ${process.env.GEMINI_MODEL || "gemini-3.8-flash"})`);
      console.log("OTP terminal mode: disabled");
      console.log(
        `Dev Login mode:    ${
          process.env.NODE_ENV === "development" &&
          process.env.DEV_AUTH_BYPASS === "true"
            ? "ENABLED (development only)"
            : "disabled"
        }`
      );
      console.log(`Scheduler:         running`);
      console.log("=================================================");
      console.log("");
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Fatal] Port ${PORT} is already in use by another process.`);
        process.exit(1);
      }
      console.error("[Server Error]", err.message);
    });
  })

  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  });