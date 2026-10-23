// ============================================================
// FINANCEOS - CENTRALIZED EMAIL SERVICE (PRODUCTION SMTP)
// ============================================================

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const nodemailer = require("nodemailer");

/**
 * Safe email masker for logs: never exposes full email or credentials
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "***@***";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser =
    user.length > 2
      ? `${user[0]}***${user[user.length - 1]}`
      : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
}

/**
 * Validates if an email is syntactically valid and has a deliverable external domain.
 * Blocks obvious dummy/mock/typo domains to prevent silent outbound bounces.
 */
function isDeliverableEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();

  // Basic structure check: must have user@domain.tld with tld >= 2 chars
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return false;

  const [, domain] = trimmed.split("@");
  if (!domain) return false;

  // Disallow mock / test / placeholder domains
  const blockedDomains = [
    "test.com",
    "example.com",
    "example.org",
    "example.net",
    "fake.com",
    "sample.com",
    "financeos-test.com",
    "invalid.com",
    "localhost",
  ];
  if (blockedDomains.includes(domain)) return false;

  // Disallow obvious typos like .com.com, .co.com, or incomplete TLDs
  if (
    domain.endsWith(".com.com") ||
    domain.endsWith(".co.com") ||
    domain.endsWith(".test")
  ) {
    return false;
  }

  // TLD check (last segment after dot must be at least 2 alpha characters)
  const segments = domain.split(".");
  const tld = segments[segments.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return false;
  }

  return true;
}

let cachedTransporter = null;
let lastEmailUser = null;
let lastEmailPass = null;

function getTransporter() {
  const currentPassword = (process.env.EMAIL_PASSWORD || "")
    .toString()
    .replace(/\s+/g, "");
  const currentUser = (process.env.EMAIL_USER || "").toString().trim();

  if (
    cachedTransporter &&
    lastEmailUser === currentUser &&
    lastEmailPass === currentPassword
  ) {
    return cachedTransporter;
  }

  if (cachedTransporter && typeof cachedTransporter.close === "function") {
    try {
      cachedTransporter.close();
    } catch (_) {}
  }

  lastEmailUser = currentUser;
  lastEmailPass = currentPassword;

  cachedTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    auth: {
      user: currentUser,
      pass: currentPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  return cachedTransporter;
}

// Default transporter export for backwards compatibility
const transporter = getTransporter();

/**
 * Safely sanitizes SMTP errors into clean, informative messages without exposing internal credentials or tokens.
 */
function sanitizeSmtpError(error) {
  if (!error) return "Unknown SMTP error";
  const msg = String(error.message || "");
  const code = error.code || (error.responseCode ? `E${error.responseCode}` : null);

  if (
    code === "EAUTH" ||
    msg.includes("535") ||
    msg.includes("BadCredentials") ||
    msg.includes("Username and Password not accepted")
  ) {
    return "Authentication failed: 535-5.7.8 BadCredentials (Invalid Gmail address or App Password)";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
    return "SMTP connection timed out (Port 465 SSL)";
  }
  if (code === "ECONNREFUSED") {
    return "SMTP connection refused by host";
  }
  if (code === "ENOTFOUND") {
    return "SMTP server host not found (DNS failure)";
  }
  return error.code || "SMTP delivery failure";
}

/**
 * Safe programmatic diagnostic for SMTP connectivity.
 * Returns only boolean connection state and sanitized status message.
 */
async function checkSmtpConnection() {
  const currentPassword = (process.env.EMAIL_PASSWORD || "")
    .toString()
    .replace(/\s+/g, "");

  if (!process.env.EMAIL_USER || !currentPassword) {
    return {
      configured: false,
      connected: false,
      status: "UNCONFIGURED",
      message: "EMAIL_USER or EMAIL_PASSWORD missing in backend environment configuration",
    };
  }

  try {
    const activeTransporter = getTransporter();
    await activeTransporter.verify();
    return {
      configured: true,
      connected: true,
      status: "CONNECTED",
      message: "Gmail SMTP connected and verified successfully",
    };
  } catch (error) {
    const sanitized = sanitizeSmtpError(error);
    return {
      configured: true,
      connected: false,
      status: "FAILED",
      code: error.code || "EAUTH",
      message: sanitized,
    };
  }
}

/**
 * Verify transporter at startup without logging sensitive secrets.
 */
async function verifyTransporter() {
  const diagnostic = await checkSmtpConnection();

  if (!diagnostic.configured) {
    console.log("Email service configured: NO");
    return false;
  }

  console.log("Email service configured: YES");
  if (diagnostic.connected) {
    console.log("SMTP transporter verified: YES");
    return true;
  } else {
    console.error("SMTP transporter verified: NO -", diagnostic.message);
    return false;
  }
}

/**
 * Base email sender helper. Inspects accepted/rejected to verify SMTP acceptance.
 */
async function sendEmail({ to, subject, text, html, icalEvent, attachments }) {
  const cleanTo = (to || "").trim();

  if (!cleanTo) {
    console.warn("[EmailService] Missing recipient email address.");
    return {
      success: false,
      error: "No recipient email provided",
      accepted: [],
      rejected: [],
    };
  }

  if (!isDeliverableEmail(cleanTo)) {
    console.warn(
      `[EmailService] Recipient rejected: Invalid or undeliverable format: ${maskEmail(cleanTo)}`
    );
    return {
      success: false,
      error: `Recipient address '${maskEmail(cleanTo)}' is invalid, mock, or undeliverable`,
      accepted: [],
      rejected: [cleanTo],
    };
  }

  const senderEmail = process.env.EMAIL_USER;
  if (!senderEmail) {
    console.error("[EmailService] EMAIL_USER not configured.");
    return {
      success: false,
      error: "EMAIL_USER not configured on server",
      accepted: [],
      rejected: [cleanTo],
    };
  }

  const mailOptions = {
    from: `"FinanceOS" <${senderEmail}>`,
    to: cleanTo,
    replyTo: senderEmail,
    subject: subject || "FinanceOS Notification",
    text: text || "",
    html: html || text || "",
    ...(icalEvent ? { icalEvent } : {}),
    ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
  };

  try {
    const activeTransporter = getTransporter();
    const info = await activeTransporter.sendMail(mailOptions);
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    const isAccepted = accepted.length > 0 && !rejected.includes(cleanTo);

    console.log(
      `[EmailService] SMTP Dispatch: Recipient=${maskEmail(cleanTo)} | Accepted=${isAccepted} | Response=${info.response || "250 OK"} | MessageId=${info.messageId}`
    );

    return {
      success: isAccepted,
      accepted,
      rejected,
      response: info.response,
      messageId: info.messageId,
      envelope: info.envelope,
      error: isAccepted
        ? null
        : "Recipient address was not accepted by SMTP server",
    };
  } catch (error) {
    const sanitized = sanitizeSmtpError(error);
    const sanitizedCode = error.code || (error.responseCode ? `E${error.responseCode}` : "ESMTP");
    console.error(
      `[EmailService] SMTP Failure to ${maskEmail(cleanTo)}: ${sanitized} (code: ${sanitizedCode})`
    );
    return {
      success: false,
      error: sanitized,
      accepted: [],
      rejected: [cleanTo],
    };
  }
}

/**
 * Send an email notification for Admin messages and system communications
 */
async function sendAdminMessageEmail({
  to,
  recipientName = "FinanceOS User",
  subject = "FinanceOS Communication",
  message = "",
  category = "Important Update",
}) {
  const formattedMessage = message
    ? message.replace(/\n/g, "<br/>")
    : "You have a new update in your FinanceOS account.";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f8f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f6f8f4; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2ebd9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #173b2b 0%, #295741 100%); padding: 30px; text-align: left;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td>
                        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
                          Finance<span style="color: #8ed867;">OS</span>
                        </h1>
                        <p style="color: #c9decb; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                          ${category}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CONTENT -->
              <tr>
                <td style="padding: 35px 30px 25px 30px;">
                  <p style="color: #173b2b; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
                    Hello ${recipientName},
                  </p>
                  
                  <div style="background-color: #f9fbf8; border: 1px solid #e5ede0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #28553d; font-size: 15px; font-weight: 700; margin: 0 0 12px 0; border-bottom: 1px solid #e5ede0; padding-bottom: 8px;">
                      ${subject}
                    </h3>
                    <div style="color: #3b5043; font-size: 14px; line-height: 1.6; word-break: break-word;">
                      ${formattedMessage}
                    </div>
                  </div>

                  <p style="color: #6a7c71; font-size: 13px; line-height: 1.5; margin: 25px 0 0 0;">
                    Please visit your FinanceOS dashboard to view details and take any necessary actions.
                  </p>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #fafcf9; border-top: 1px solid #eef3ec; padding: 20px 30px; text-align: center;">
                  <p style="color: #8fa095; font-size: 12px; margin: 0;">
                    &copy; ${new Date().getFullYear()} FinanceOS &bull; Manage Today, Secure Tomorrow.
                  </p>
                  <p style="color: #a7b6ad; font-size: 11px; margin: 6px 0 0 0;">
                    This is an official communication sent to ${maskEmail(to)}.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hello ${recipientName},\n\n${message}\n\nRegards,\nFinanceOS Team`;

  return sendEmail({
    to,
    subject: subject || "FinanceOS Communication",
    text,
    html,
  });
}

/**
 * Send a financial reminder email with real MongoDB data
 * Format follows PART N requirement strictly:
 * Subject: FinanceOS Reminder: <Reminder Title>
 * Body:
 * Hello <User Name>,
 * This is your FinanceOS reminder.
 * Reminder: <Title>
 * Details: <Description>
 * Due: <Date and Time>
 * Linked financial item: <actual linked item if available>
 * Please review your FinanceOS account.
 * Regards,
 * FinanceOS
 */
/**
 * Generate RFC 5545 iCalendar (.ics) string for financial reminders
 */
function generateICSContent({
  uid,
  title,
  description,
  dueDate,
  amount,
  category,
}) {
  const dateObj = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const validDate = !Number.isNaN(dateObj.getTime()) ? dateObj : new Date();

  const year = validDate.getUTCFullYear();
  const month = String(validDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(validDate.getUTCDate()).padStart(2, "0");
  const dtStart = `${year}${month}${day}T090000Z`;
  const dtEnd = `${year}${month}${day}T100000Z`;

  const now = new Date();
  const dtStamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const cleanTitle = (title || "FinanceOS Reminder").replace(/[\r\n]+/g, " ");
  const cleanDesc = (description || "FinanceOS reminder").replace(/[\r\n]+/g, " ");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FinanceOS//Financial Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid || `financeos-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`}@financeos.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT1440M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${cleanTitle}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Send a financial reminder email with real MongoDB data and calendar event
 */
async function sendReminderEmail({
  to,
  recipientName = "FinanceOS User",
  reminderTitle = "Financial Reminder",
  description = "Upcoming financial obligation",
  dueDate = "Upcoming",
  linkedItem = null,
  category = "Reminder",
  amount = 0,
  reminderRule = "1 day before",
}) {
  const dueDateObj = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const formattedDueDate = !Number.isNaN(dueDateObj.getTime())
    ? dueDateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : String(dueDate || "Upcoming");

  const formattedAmount = Number(amount) > 0
    ? `₹${Number(amount).toLocaleString("en-IN")}`
    : "₹0";

  const eventName = `${reminderTitle} Due`;
  const planName = linkedItem || reminderTitle;
  const calendarEventTitle = `${reminderTitle} – ${formattedAmount}`;
  const calendarDescription = `FinanceOS reminder for ${reminderTitle} (${category}). Amount: ${formattedAmount}. Due Date: ${formattedDueDate}.`;

  const icsContent = generateICSContent({
    uid: `financeos-rem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title: calendarEventTitle,
    description: calendarDescription,
    dueDate: dueDateObj,
    amount,
    category,
  });

  // Google Calendar URL for web fallback
  const validDate = !Number.isNaN(dueDateObj.getTime()) ? dueDateObj : new Date();
  const y = validDate.getUTCFullYear();
  const m = String(validDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(validDate.getUTCDate()).padStart(2, "0");
  const dtStart = `${y}${m}${d}T090000Z`;
  const dtEnd = `${y}${m}${d}T100000Z`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    calendarEventTitle
  )}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(calendarDescription)}`;

  const subject = `FinanceOS Reminder: ${reminderTitle} Due`;

  const text = `FinanceOS Reminder\n\nEvent: ${eventName}\nAmount: ${formattedAmount}\nDue Date: ${formattedDueDate}\nPlan/Commitment: ${planName}\nReminder: ${reminderRule}\nCalendar: Add to Calendar (${googleCalendarUrl})\n\nHello ${recipientName},\n\nThis is your FinanceOS reminder.\n\nReminder: ${reminderTitle}\nDetails: ${description}\nDue Date: ${formattedDueDate}\nAmount: ${formattedAmount}\nLinked financial item: ${planName} (${category})\n\nPlease review your FinanceOS account.\n\nRegards,\nFinanceOS`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f8f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f6f8f4; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2ebd9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #173b2b 0%, #295741 100%); padding: 30px; text-align: left;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">
                    Finance<span style="color: #8ed867;">OS</span> Reminder
                  </h1>
                  <p style="color: #c9decb; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                    ${category} &bull; Calendar Invitation Attached
                  </p>
                </td>
              </tr>

              <!-- BODY -->
              <tr>
                <td style="padding: 35px 30px 25px 30px;">
                  <p style="color: #173b2b; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                    Hello ${recipientName},
                  </p>
                  <p style="color: #4b5e52; font-size: 14px; margin: 0 0 20px 0;">
                    This is your FinanceOS reminder for an upcoming financial obligation.
                  </p>
                  
                  <div style="background-color: #f9fbf8; border: 1px solid #e5ede0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <div style="margin-bottom: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Event</span>
                      <div style="color: #173b2b; font-size: 16px; font-weight: 700; margin-top: 2px;">
                        ${eventName}
                      </div>
                    </div>

                    <div style="margin-bottom: 12px; display: flex; gap: 20px;">
                      <div>
                        <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Amount</span>
                        <div style="color: #173b2b; font-size: 16px; font-weight: 800; margin-top: 2px;">
                          ${formattedAmount}
                        </div>
                      </div>
                      <div style="margin-left: 25px;">
                        <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Due Date</span>
                        <div style="color: #28553d; font-size: 14px; font-weight: 700; margin-top: 2px;">
                          ${formattedDueDate}
                        </div>
                      </div>
                    </div>

                    <div style="margin-bottom: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Plan / Commitment</span>
                      <div style="color: #3b5043; font-size: 14px; font-weight: 600; margin-top: 2px;">
                        ${planName}
                      </div>
                    </div>

                    <div style="margin-bottom: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Reminder Rule</span>
                      <div style="color: #52665b; font-size: 13px; margin-top: 2px;">
                        ${reminderRule}
                      </div>
                    </div>

                    <div style="margin-bottom: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: #6a7c71; text-transform: uppercase; letter-spacing: 0.5px;">Details</span>
                      <div style="color: #3b5043; font-size: 13px; margin-top: 2px; line-height: 1.5;">
                        ${description}
                      </div>
                    </div>

                    <!-- CALENDAR ACTION -->
                    <div style="border-top: 1px solid #eef3ec; padding-top: 16px; margin-top: 16px; text-align: center;">
                      <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #315c46; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 22px; border-radius: 8px; box-shadow: 0 2px 6px rgba(49,92,70,0.25);">
                        📅 Add to Calendar
                      </a>
                      <p style="color: #8fa095; font-size: 11px; margin: 8px 0 0 0;">
                        A calendar event attachment (.ics) is also included with this email.
                      </p>
                    </div>
                  </div>

                  <p style="color: #6a7c71; font-size: 13px; line-height: 1.5; margin: 25px 0 0 0;">
                    Please review your FinanceOS account to stay on top of your financial plan.
                  </p>

                  <p style="color: #173b2b; font-size: 14px; font-weight: 600; margin: 20px 0 0 0;">
                    Regards,<br/>
                    FinanceOS
                  </p>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #fafcf9; border-top: 1px solid #eef3ec; padding: 20px 30px; text-align: center;">
                  <p style="color: #8fa095; font-size: 12px; margin: 0;">
                    &copy; ${new Date().getFullYear()} FinanceOS &bull; Manage Today, Secure Tomorrow.
                  </p>
                  <p style="color: #a7b6ad; font-size: 11px; margin: 6px 0 0 0;">
                    Sent to ${maskEmail(to)}. This notification does not alter your account balances or financial records.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    icalEvent: {
      filename: "financeos-reminder.ics",
      method: "REQUEST",
      content: icsContent,
    },
    attachments: [
      {
        filename: "financeos-reminder.ics",
        content: icsContent,
        contentType: "text/calendar; charset=UTF-8; method=REQUEST",
      },
    ],
  });
}

/**
 * Consolidated OTP email sender for authentication
 */
async function sendOTPEmail(email, otp) {
  const subject = "FinanceOS Login OTP";
  const text = `Hello,\n\nYour OTP for signing in to FinanceOS is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nFinanceOS - Manage Today, Secure Tomorrow`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #f7f9f4; border-radius: 12px;">
      <h2 style="color:#43822e;">FinanceOS</h2>
      <p>Hello,</p>
      <p>Your OTP for signing in to FinanceOS is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #173b2b; background: #e7f3d8; padding: 18px; text-align: center; border-radius: 10px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This OTP is valid for <strong>5 minutes</strong>.</p>
      <p style="color:#777;">If you did not request this OTP, please ignore this email.</p>
      <hr />
      <p style="font-size:12px;color:#888;">FinanceOS - Manage Today, Secure Tomorrow</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

module.exports = {
  transporter,
  getTransporter,
  maskEmail,
  isDeliverableEmail,
  sanitizeSmtpError,
  checkSmtpConnection,
  verifyTransporter,
  sendEmail,
  sendAdminMessageEmail,
  sendReminderEmail,
  generateICSContent,
  sendOTPEmail,
};
