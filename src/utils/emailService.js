import { Resend } from 'resend';
import logger from './logger.js';

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM     = process.env.FROM_EMAIL   || 'MiniBazar ERP <onboarding@resend.dev>';

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Email template ────────────────────────────────────────────────────────────
const template = (content) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#10b981,#065f46);padding:28px 32px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">MiniBazar ERP</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">মিষ্টান্ন ইনভেন্টরি ম্যানেজমেন্ট</p>
    </div>
    <div style="padding:32px;">
      ${content}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 20px;">
      <p style="color:#aaa;font-size:11px;text-align:center;margin:0;">
        © 2026 MiniBazar ERP by Wahidsadik Aditto. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;

// ── Send helper ───────────────────────────────────────────────────────────────
const sendMail = async ({ to, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('⚠️  RESEND_API_KEY not set — email logged to console only.');
    logger.info(`📧 [DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }

  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

  if (error) {
    logger.error(`❌ Email send failed to ${to}: ${error.message}`);
    throw new Error(error.message);
  }

  logger.info(`✅ Email sent to ${to} | Id: ${data.id}`);
};

// ── Verification Email ────────────────────────────────────────────────────────
export const sendVerificationEmail = async (email, name, token) => {
  const link = `${FRONTEND}/verify-email?token=${token}`;

  await sendMail({
    to: email,
    subject: '✅ MiniBazar ERP — ইমেইল যাচাই করুন',
    html: template(`
      <h2 style="color:#111;margin:0 0 12px;font-size:20px;">স্বাগতম, ${name}! 🎉</h2>
      <p style="color:#555;line-height:1.7;margin:0 0 20px;">
        আপনার <strong>MiniBazar ERP</strong> অ্যাকাউন্ট তৈরি হয়েছে।
        ব্যবহার শুরু করতে নিচের বাটনে ক্লিক করে ইমেইল যাচাই করুন।
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}"
           style="background:#10b981;color:#ffffff;padding:14px 36px;border-radius:8px;
                  text-decoration:none;font-weight:bold;font-size:16px;
                  display:inline-block;letter-spacing:0.3px;">
          ✅ ইমেইল যাচাই করুন
        </a>
      </div>
      <p style="color:#888;font-size:13px;margin:0 0 8px;">
        অথবা এই লিংক browser-এ paste করুন:
      </p>
      <p style="background:#f4f4f4;border-radius:6px;padding:10px 12px;font-size:12px;
                color:#555;word-break:break-all;margin:0 0 20px;">${link}</p>
      <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;padding:12px 14px;">
        <p style="color:#795548;font-size:13px;margin:0;">
          ⏰ এই link <strong>২৪ ঘণ্টা</strong> পর মেয়াদ শেষ হবে।
          Email না পেলে <strong>Spam/Junk</strong> ফোল্ডার চেক করুন।
        </p>
      </div>
    `),
  });
};

// ── Password Reset Email ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${FRONTEND}/shop/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: '🔑 MiniBazar ERP — পাসওয়ার্ড রিসেট করুন',
    html: template(`
      <h2 style="color:#111;margin:0 0 12px;font-size:20px;">হ্যালো, ${name}!</h2>
      <p style="color:#555;line-height:1.7;margin:0 0 20px;">
        আপনি পাসওয়ার্ড রিসেটের অনুরোধ করেছেন।
        নিচের বাটনে ক্লিক করে নতুন পাসওয়ার্ড দিন।
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}"
           style="background:#10b981;color:#ffffff;padding:14px 36px;border-radius:8px;
                  text-decoration:none;font-weight:bold;font-size:16px;
                  display:inline-block;">
          🔑 নতুন পাসওয়ার্ড দিন
        </a>
      </div>
      <p style="color:#888;font-size:13px;margin:0 0 8px;">
        অথবা এই লিংক browser-এ paste করুন:
      </p>
      <p style="background:#f4f4f4;border-radius:6px;padding:10px 12px;font-size:12px;
                color:#555;word-break:break-all;margin:0 0 20px;">${link}</p>
      <div style="background:#fce4ec;border:1px solid #f48fb1;border-radius:8px;padding:12px 14px;">
        <p style="color:#880e4f;font-size:13px;margin:0;">
          ⏰ এই link <strong>১ ঘণ্টা</strong> পর মেয়াদ শেষ হবে।
          আপনি এই অনুরোধ না করলে এই email উপেক্ষা করুন।
        </p>
      </div>
    `),
  });
};
