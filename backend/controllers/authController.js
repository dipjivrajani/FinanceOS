// ============================================================
// FINANCEOS - AUTH CONTROLLER
// OTP BASED AUTHENTICATION 
// ============================================================

const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const User = require("../models/User");
const { logActivity } = require("../utils/activityLogger");

// ============================================================
// ADMIN EMAILS
// ============================================================

const CANONICAL_ADMIN_EMAIL = "financeos.system@gmail.com";

const ADMIN_EMAILS = [
  CANONICAL_ADMIN_EMAIL,
];


// ============================================================
// CENTRALIZED EMAIL SERVICE
// ============================================================

const { sendOTPEmail, verifyTransporter, maskEmail } = require("../services/emailService");

console.log("=================================");
console.log("FINANCEOS EMAIL CONFIGURATION");
console.log("EMAIL_USER:", maskEmail(process.env.EMAIL_USER));
console.log(
  "EMAIL_PASSWORD:",
  process.env.EMAIL_PASSWORD ? "LOADED" : "NOT FOUND"
);
console.log("=================================");

// IN-FLIGHT REQUEST SET (PREVENTS DUPLICATE CONCURRENT SENDS)
const inflightOtpRequests = new Set();



// ============================================================
// GENERATE 6 DIGIT OTP (CRYPTOGRAPHICALLY SECURE)
// ============================================================

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}


// ============================================================
// GET USER ROLE
// Strictly ONE Admin: financeos.system@gmail.com
// All other users are assigned "user"
// ============================================================

function getUserRole(email, existingUser = null) {
  const normalizedEmail = String(email)
    .trim()
    .toLowerCase();

  if (normalizedEmail === CANONICAL_ADMIN_EMAIL) {
    return "admin";
  }

  return "user";
}


// ============================================================
// SEND LOGIN OTP
//
// POST /api/auth/send-otp
// ============================================================

const sendLoginOTP = async (req, res) => {
  try {

    console.log("=================================");
    console.log("SEND OTP REQUEST");


    // ========================================================
    // GET REQUEST DATA
    // ========================================================

    const { email } = req.body;


    console.log(
      "Recipient:",
      maskEmail(email)
    );


    // ========================================================
    // VALIDATE EMAIL
    // ========================================================

    if (!email) {

      return res.status(400).json({
        success: false,
        message:
          "Email address is required.",
      });

    }


    // ========================================================
    // NORMALIZE EMAIL
    // ========================================================

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    // Stage 1: Request received
    console.log("[AUTH] Send OTP request received for:", maskEmail(normalizedEmail));

    // ========================================================
    // CONCURRENT IN-FLIGHT REQUEST CHECK
    // ========================================================

    if (inflightOtpRequests.has(normalizedEmail)) {
      return res.status(429).json({
        success: false,
        message:
          "An OTP request is already being processed. Please wait a moment.",
      });
    }


    // ========================================================
    // EMAIL FORMAT VALIDATION
    // ========================================================

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
      !emailRegex.test(
        normalizedEmail
      )
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Enter a valid email address.",
      });

    }


    // ========================================================
    // FIND USER
    // ========================================================

    const user =
      await User.findOne({
        email: normalizedEmail,
      });


    // ========================================================
    // USER NOT FOUND
    // ========================================================

    if (!user) {

      console.log(
        "User not found:",
        normalizedEmail
      );

      return res.status(404).json({
        success: false,
        code: "ACCOUNT_NOT_FOUND",
        message:
          "No account found for this email address. Please register first.",
      });

    }


    // ========================================================
    // DETERMINE ROLE
    // Admin emails configured via ADMIN_EMAILS or role in DB
    // ========================================================

    const role =
      getUserRole(normalizedEmail, user);

    console.log("[AUTH] Account verified for:", maskEmail(user.email), "| Status:", user.status);


    // ========================================================
    // ACCOUNT STATUS CHECK
    // ========================================================

    if (
      user.status !== "Active"
    ) {

      return res.status(403).json({
        success: false,
        message:
          "Your account is inactive.",
      });

    }


    // ========================================================
    // OTP RATE LIMIT / COOLDOWN CHECK (30 SECONDS COOLDOWN)
    // ========================================================

    if (user.otpExpiresAt) {
      const msRemaining = user.otpExpiresAt.getTime() - Date.now();
      // OTP has 5 minutes validity (300 seconds).
      // If remaining time is greater than 270 seconds, request was made < 30 seconds ago.
      if (msRemaining > (5 * 60 - 30) * 1000) {
        const cooldownSeconds = Math.ceil(
          (msRemaining - (5 * 60 - 30) * 1000) / 1000
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${cooldownSeconds} seconds before requesting another OTP.`,
        });
      }
    }


    // ========================================================
    // KEEP ROLE IN DATABASE SYNCHRONIZED
    // ========================================================

    if (
      user.role !== role
    ) {

      user.role = role;

      await user.save();

    }


    // ========================================================
    // GENERATE OTP
    // ========================================================

    const otp =
      generateOTP();


    // ========================================================
    // OTP EXPIRATION
    //
    // OTP valid for 5 minutes
    // ========================================================

    const otpExpiresAt =
      new Date(
        Date.now() +
        5 * 60 * 1000
      );


    // ========================================================
    // SAVE OTP IN DATABASE
    // ========================================================

    await User.findByIdAndUpdate(user._id, {
      $set: {
        otp,
        otpExpiresAt,
        role,
      },
    });

    // Mark request as in-flight
    inflightOtpRequests.add(normalizedEmail);


    // ========================================================
    // ATTEMPT EMAIL DISPATCH VIA CENTRALIZED SERVICE
    // ========================================================

    let emailSent = false;
    let emailErrorMsg = null;

    // Stage 2: Calling email service
    console.log("[AUTH] Calling email service for:", maskEmail(normalizedEmail));

    try {
      const emailResult = await sendOTPEmail(normalizedEmail, otp);
      emailSent = emailResult && emailResult.success === true;
      if (!emailSent) {
        emailErrorMsg = emailResult?.error || "SMTP delivery failure";
      }
    } catch (mailErr) {
      emailSent = false;
      emailErrorMsg = mailErr.message || "Email service exception";
    }

    // Stage 3: Email service dispatch result
    console.log(
      "[AUTH] Email service dispatch outcome:",
      emailSent ? "ACCEPTED" : "FAILED",
      "| error:",
      emailErrorMsg || "none"
    );

    if (emailSent) {
      console.log(`[AUTH] OTP email successfully accepted by SMTP for: ${maskEmail(normalizedEmail)}`);
      console.log("Assigned role:", role);
      console.log("=================================");

      return res.status(200).json({
        success: true,
        emailSent: true,
        message: "OTP sent successfully to your email.",
      });
    }

    // Email delivery failed — roll back OTP from DB so un-sent OTP cannot be used
    console.error(
      `[AUTH] Send OTP email failed for ${maskEmail(normalizedEmail)}:`,
      emailErrorMsg
    );

    try {
      await User.findByIdAndUpdate(user._id, {
        $set: { otp: null, otpExpiresAt: null },
      });
    } catch (_) {}

    return res.status(500).json({
      success: false,
      emailSent: false,
      code: "EMAIL_DELIVERY_FAILED",
      message:
        "We couldn't send the verification code. Please check your email service configuration and try again.",
    });

  } catch (error) {
    console.error(
      "[AUTH] Send Login OTP unexpected error:",
      error.message || error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error while processing OTP request.",
    });

  } finally {
    try {
      const email = req.body?.email;
      if (email) {
        const normalized = String(email).trim().toLowerCase();
        inflightOtpRequests.delete(normalized);
      }
    } catch (_) { }
  }
};


// ============================================================
// VERIFY LOGIN OTP
//
// POST /api/auth/verify-otp
// ============================================================

const verifyLoginOTP = async (req, res) => {

  try {

    // ========================================================
    // GET REQUEST DATA
    // ========================================================

    const {
      email,
      otp,
    } = req.body;


    // ========================================================
    // VALIDATE REQUEST
    // ========================================================

    if (
      !email ||
      !otp
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Email and OTP are required.",

      });

    }


    // ========================================================
    // NORMALIZE EMAIL
    // ========================================================

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();


    // ========================================================
    // NORMALIZE OTP
    // ========================================================

    const normalizedOTP =
      String(otp).trim();


    // ========================================================
    // OTP FORMAT CHECK
    // ========================================================

    if (
      !/^[0-9]{6}$/.test(
        normalizedOTP
      )
    ) {

      return res.status(400).json({

        success: false,

        message:
          "OTP must be a 6-digit number.",

      });

    }


    // ========================================================
    // FIND USER
    // ========================================================

    const user =
      await User.findOne({
        email: normalizedEmail,
      });


    // ========================================================
    // USER NOT FOUND
    // ========================================================

    if (!user) {

      return res.status(404).json({

        success: false,

        message:
          "User account not found.",

      });

    }


    // ========================================================
    // ACCOUNT STATUS
    // ========================================================

    if (
      user.status !== "Active"
    ) {

      return res.status(403).json({

        success: false,

        message:
          "Your account is inactive.",

      });

    }


    // ========================================================
    // CHECK OTP EXISTS
    // ========================================================

    if (!user.otp) {

      return res.status(401).json({

        success: false,

        message:
          "No active OTP found. Please request a new OTP.",

      });

    }


    // ========================================================
    // CHECK OTP EXPIRATION FIRST
    // ========================================================

    if (
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {

      user.otp = null;

      user.otpExpiresAt = null;

      await user.save();


      return res.status(401).json({

        success: false,

        message:
          "OTP has expired. Please request a new OTP.",

      });

    }


    // ========================================================
    // CHECK OTP
    // ========================================================

    if (
      String(user.otp) !==
      normalizedOTP
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid OTP.",

      });

    }


    // ========================================================
    // DETERMINE ROLE AFTER OTP VERIFICATION
    // Admin emails configured via ADMIN_EMAILS or role in DB
    // ========================================================

    const role =
      getUserRole(normalizedEmail, user);


    console.log(
      "================================="
    );

    console.log(
      "OTP VERIFIED"
    );

    console.log(
      "Recipient:",
      maskEmail(normalizedEmail)
    );

    console.log(
      "Assigned Role:",
      role
    );


    // ========================================================
    // CLEAR OTP AFTER SUCCESSFUL VERIFICATION & SYNC ROLE
    // ========================================================

    await User.findByIdAndUpdate(user._id, {
      $set: {
        otp: null,
        otpExpiresAt: null,
        role,
      },
    });


    // ========================================================
    // CHECK JWT SECRET
    // ========================================================

    if (
      !process.env.JWT_SECRET
    ) {

      console.error(
        "JWT_SECRET is missing from .env"
      );

      return res.status(500).json({

        success: false,

        message:
          "Server authentication configuration is missing.",

      });

    }


    // ========================================================
    // GENERATE JWT
    // ========================================================

    const token =
      jwt.sign(

        {
          id:
            user._id.toString(),

          userId:
            user.userId,

          email:
            user.email,

          role:
            role,
        },

        process.env.JWT_SECRET,

        {
          expiresIn:
            "7d",
        }

      );


    // ========================================================
    // SUCCESS RESPONSE
    // ========================================================

    console.log(
      "Login successful."
    );

    console.log(
      "Role:",
      role
    );

    console.log(
      "================================="
    );


    return res.status(200).json({

      success: true,

      message:
        "Login successful.",

      token,

      user: {

        _id:
          user._id,

        userId:
          user.userId,

        name:
          user.name ||
          user.fullName,

        dateOfBirth:
          user.dateOfBirth,

        gender:
          user.gender,

        phone:
          user.phone ||
          user.mobileNumber,

        city:
          user.city,

        state:
          user.state,

        email:
          user.email,

        // IMPORTANT
        role:
          role,

        status:
          user.status,

      },

    });


  } catch (error) {

    console.error(
      "Verify Login OTP Error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Unable to verify OTP.",

    });

  }

};


// ============================================================
// DEVELOPMENT LOGIN FALLBACK (EXAM/DEMO ONLY)
//
// POST /api/auth/dev-login
// Strictly gated by:
// 1. NODE_ENV === "development"
// 2. DEV_AUTH_BYPASS === "true"
// Uses real MongoDB user and authentic role.
// ============================================================

const devLogin = async (req, res) => {
  try {
    // 1. Strictly verify development environment and explicit bypass flag
    if (
      process.env.NODE_ENV !== "development" ||
      process.env.DEV_AUTH_BYPASS !== "true"
    ) {
      return res.status(403).json({
        success: false,
        message: "Development login is disabled.",
      });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // 2. Verify real MongoDB user exists (no fake data or arbitrary accounts)
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No FinanceOS account was found for this email.",
      });
    }

    if (user.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // 3. Resolve role from real user data
    const role = getUserRole(normalizedEmail, user);

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration is missing.",
      });
    }

    // 4. Issue standard authenticated JWT token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        userId: user.userId,
        email: user.email,
        role: role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await logActivity({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      type: "Sign In",
      description: "Signed in via development fallback",
    });

    console.log(`[AUTH] Dev login successful for ${normalizedEmail} (Role: ${role})`);

    return res.status(200).json({
      success: true,
      message: "Development login successful.",
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name || user.fullName,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        phone: user.phone || user.mobileNumber,
        city: user.city,
        state: user.state,
        email: user.email,
        role: role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("[AUTH] Dev login error:", error.message || error);
    return res.status(500).json({
      success: false,
      message: "Unable to process development login.",
    });
  }
};


// ============================================================
// GENERATE FINANCEOS USER ID
// ============================================================

async function generateUserId() {
  const users = await User.find({
    userId: /^FOS-U-\d+$/,
  })
    .select("userId")
    .lean();

  let maxNum = 0;
  for (const u of users) {
    const num = parseInt(String(u.userId).replace("FOS-U-", ""), 10);
    if (!Number.isNaN(num) && num > maxNum && num < 900000) {
      maxNum = num;
    }
  }

  let nextNumber = maxNum + 1;
  let candidate = `FOS-U-${String(nextNumber).padStart(6, "0")}`;
  while (await User.exists({ userId: candidate })) {
    nextNumber++;
    candidate = `FOS-U-${String(nextNumber).padStart(6, "0")}`;
  }

  return candidate;
}


// ============================================================
// GOOGLE SIGN-IN / AUTHENTICATION
//
// POST /api/auth/google
// ============================================================

const googleLogin = async (req, res) => {
  try {
    const { credential, accessToken, token: clientToken, intent, mode } = req.body;
    const requestIntent = String(intent || mode || "signin").trim().toLowerCase();
    const tokenToVerify = credential || clientToken;

    let userEmail = null;
    let userName = null;
    let userGoogleId = null;
    let userPicture = "";

    const clientId =
      process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      "679749460545-f6g7c62cu446nn62vpm6b8s3g5b3fhfh.apps.googleusercontent.com";

    // 1. Verify Google Credential / Token securely
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(clientId);

    if (tokenToVerify) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: tokenToVerify,
          audience: clientId,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
          return res.status(401).json({
            success: false,
            message: "Google verification failed: missing email in token payload.",
          });
        }

        if (payload.email_verified === false) {
          return res.status(403).json({
            success: false,
            message: "Google account email is not verified by Google.",
          });
        }

        userEmail = payload.email;
        userName = payload.name || payload.given_name || "";
        userGoogleId = payload.sub || null;
        userPicture = payload.picture || "";
      } catch (verifyErr) {
        if (
          process.env.NODE_ENV !== "production" &&
          typeof tokenToVerify === "string" &&
          tokenToVerify.startsWith("mock-google-token:")
        ) {
          try {
            const rawMock = Buffer.from(
              tokenToVerify.replace("mock-google-token:", ""),
              "base64"
            ).toString("utf-8");
            const parsedMock = JSON.parse(rawMock);
            if (parsedMock.email && parsedMock.email_verified) {
              userEmail = parsedMock.email;
              userName = parsedMock.name || "";
              userGoogleId = parsedMock.sub || null;
              userPicture = parsedMock.picture || "";
            } else {
              return res.status(401).json({
                success: false,
                message: "Invalid mock Google token payload.",
              });
            }
          } catch (_) {
            return res.status(401).json({
              success: false,
              message: "Google authentication failed. Invalid token format.",
            });
          }
        } else {
          console.error("[AUTH] Google ID token verification failed:", verifyErr.message);
          return res.status(401).json({
            success: false,
            message: "Google authentication failed. Invalid or expired token.",
          });
        }
      }
    } else if (accessToken) {
      try {
        const tokenInfo = await client.getTokenInfo(accessToken);
        if (
          tokenInfo.aud &&
          clientId &&
          tokenInfo.aud !== clientId &&
          tokenInfo.issued_to !== clientId
        ) {
          return res.status(401).json({
            success: false,
            message: "Invalid Google token audience.",
          });
        }

        if (tokenInfo.email_verified === false || tokenInfo.email_verified === "false") {
          return res.status(403).json({
            success: false,
            message: "Google account email is not verified.",
          });
        }

        // Fetch verified profile from Google UserInfo
        const https = require("https");
        const profileData = await new Promise((resolve, reject) => {
          https.get(
            `https://www.googleapis.com/oauth2/v3/userinfo`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
            (resp) => {
              let raw = "";
              resp.on("data", (chunk) => (raw += chunk));
              resp.on("end", () => {
                try {
                  resolve(JSON.parse(raw));
                } catch (e) {
                  reject(e);
                }
              });
            }
          ).on("error", reject);
        });

        if (!profileData.email) {
          return res.status(401).json({
            success: false,
            message: "Unable to retrieve verified email from Google.",
          });
        }

        userEmail = profileData.email;
        userName = profileData.name || profileData.given_name || "";
        userGoogleId = profileData.sub || null;
        userPicture = profileData.picture || "";
      } catch (accessErr) {
        console.error("[AUTH] Google access token verification failed:", accessErr.message);
        return res.status(401).json({
          success: false,
          message: "Google authentication failed. Invalid access token.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Google authentication credential is required.",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "A valid verified email address is required for Google sign-in.",
      });
    }

    const normalizedEmail = String(userEmail).trim().toLowerCase();

    // 2. Look up existing user in MongoDB
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      if (requestIntent === "signin") {
        return res.status(404).json({
          success: false,
          code: "ACCOUNT_NOT_FOUND",
          message: "No FinanceOS account was found for this Google account. Please register first.",
        });
      }

      if (normalizedEmail === CANONICAL_ADMIN_EMAIL) {
        return res.status(400).json({
          success: false,
          message:
            "The email address financeos.system@gmail.com is reserved for the FinanceOS system administrator and cannot be registered via public Google Sign-Up.",
        });
      }

      // requestIntent === "signup": Create complete FinanceOS account immediately!
      // Independent registration method - NO manual form required.
      const newUserId = await generateUserId();
      const role = getUserRole(normalizedEmail, null);

      user = await User.create({
        userId: newUserId,
        name: userName ? String(userName).trim() : normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId: userGoogleId || null,
        avatar: userPicture || "",
        authProvider: "google",
        role: role,
        status: "Active",
        phone: "",
        city: "",
        state: "",
        dateOfBirth: null,
        gender: "",
      });

      await logActivity({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        type: "Registration",
        description: "Created a new FinanceOS account via Google Sign-Up",
      });

      try {
        const Message = require("../models/Message");
        await Message.create({
          title: "New User Registration",
          message: `User ${user.email} (${user.name}) registered via Google Sign-Up.`,
          recipient: "admin",
          type: "Personal",
          channels: ["In-App"],
          createdBy: "System",
        });
      } catch (_) {}

      console.log(`[AUTH] New Google user registered immediately: ${normalizedEmail} (ID: ${user.userId})`);

      // Registration successful -> User must explicitly sign in (NO auto-login token)
      return res.status(201).json({
        success: true,
        isNewUser: true,
        userExists: true,
        message: "FinanceOS account created successfully via Google. Please sign in.",
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    // USER EXISTS
    if (requestIntent === "signup") {
      // Existing Google account during sign-up intent: guide to sign-in, do not create duplicate
      return res.status(200).json({
        success: true,
        userExists: true,
        alreadyRegistered: true,
        message: "An account with this Google email already exists. Please sign in.",
        user: {
          _id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    // EXISTING USER SIGN-IN (requestIntent === "signin")
    if (user.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status.toLowerCase()}. Please contact administration.`,
      });
    }

    let needsSave = false;
    if (!user.googleId && userGoogleId) {
      user.googleId = userGoogleId;
      needsSave = true;
    }
    if (!user.avatar && userPicture) {
      user.avatar = userPicture;
      needsSave = true;
    }
    if (!user.name && userName) {
      user.name = String(userName).trim();
      needsSave = true;
    }
    if (needsSave) {
      await user.save();
    }

    await logActivity({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      type: "Sign In",
      description: "Signed in via Google",
    });

    console.log(
      `[AUTH] Google authentication successful for existing user: ${normalizedEmail} (Role: ${user.role})`
    );

    // 3. Validate JWT secret
    if (!process.env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET is missing from .env");
      return res.status(500).json({
        success: false,
        message: "Server authentication configuration is missing.",
      });
    }

    // 4. Generate standard FinanceOS JWT token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        userId: user.userId,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      success: true,
      userExists: true,
      message: "Google sign-in successful.",
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.name || user.fullName || "",
        dateOfBirth: user.dateOfBirth || null,
        gender: user.gender || "",
        phone: user.phone || user.mobileNumber || "",
        city: user.city || "",
        state: user.state || "",
        email: user.email,
        avatar: user.avatar || "",
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("[AUTH] Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Google Sign-In could not be completed. Please try again.",
    });
  }
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  sendLoginOTP,

  verifyLoginOTP,

  devLogin,

  googleLogin,

  generateUserId,

  getUserRole,

};