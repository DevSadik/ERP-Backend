import { Resend } from 'resend';
import logger     from './logger.js';

// ── Resend client ─────────────────────────────────────────────────────────────
// Using official Resend SDK (npm package: resend)
const getClient = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('⚠️  RESEND_API_KEY is not set in .env file');
    return null;
  }
  return new Resend(key);
};

// ── From address ──────────────────────────────────────────────────────────────
const getFrom = () => {
  return process.env.FROM_EMAIL || 'MiniBazar ERP <onboarding@resend.dev>';
};

// ── Frontend URL ──────────────────────────────────────────────────────────────
const getFrontend = () => {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// ── HTML wrapper ──────────────────────────────────────────────────────────────
const buildHtml = (content) => {
  return '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">'
    + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">'
    + '<div style="background:linear-gradient(135deg,#10b981,#065f46);padding:28px 32px;text-align:center;">'
    + '<h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">MiniBazar ERP</h1>'
    + '<p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;">ইনভেন্টরি</p>'
    + '</div>'
    + '<div style="padding:32px;">'
    + content
    + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0 16px;">'
    + '<p style="color:#aaa;font-size:11px;text-align:center;margin:0;">© 2026 MiniBazar ERP by Wahidsadik Aditto</p>'
    + '</div></div></body></html>';
};

// ── Send email ────────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  const resend = getClient();

  if (!resend) {
    logger.warn('Email skipped (no API key) — To: ' + to + ' | ' + subject);
    return;
  }

  const { data, error } = await resend.emails.send({
    from:    getFrom(),
    to:      [to],
    subject: subject,
    html:    html,
  });

  if (error) {
    logger.error('❌ Resend error: ' + JSON.stringify(error));
    throw new Error(error.message || 'Resend failed');
  }

  logger.info('✅ Email sent | id: ' + data.id + ' | to: ' + to);
  return data;
};

// ── Verification Email ────────────────────────────────────────────────────────
export const sendVerificationEmail = async (email, name, token) => {
  const link = getFrontend() + '/verify-email?token=' + token;

  const content = ''
    + '<h2 style="color:#111;margin:0 0 12px;font-size:20px;">স্বাগতম, ' + name + '! 🎉</h2>'
    + '<p style="color:#555;line-height:1.7;margin:0 0 20px;">'
    + 'আপনার <strong>MiniBazar ERP</strong> অ্যাকাউন্ট তৈরি হয়েছে।'
    + ' নিচের বাটনে ক্লিক করে ইমেইল যাচাই করুন।</p>'
    + '<div style="text-align:center;margin:24px 0;">'
    + '<a href="' + link + '"'
    + ' style="background:#10b981;color:#fff;padding:14px 36px;border-radius:8px;'
    + 'text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">'
    + '✅ ইমেইল যাচাই করুন</a></div>'
    + '<p style="color:#888;font-size:12px;margin:0 0 6px;">বাটন কাজ না করলে এই লিংক copy করুন:</p>'
    + '<p style="background:#f5f5f5;border-radius:6px;padding:10px;font-size:11px;'
    + 'color:#555;word-break:break-all;margin:0 0 16px;">' + link + '</p>'
    + '<div style="background:#fffbea;border:1px solid #fcd34d;border-radius:8px;padding:12px;">'
    + '<p style="color:#92400e;font-size:12px;margin:0;">'
    + '⏰ এই link <strong>২৪ ঘণ্টা</strong> valid।'
    + ' Email না পেলে <strong>Spam</strong> ফোল্ডার চেক করুন।</p></div>';

  await sendEmail({
    to:      email,
    subject: 'MiniBazar ERP — ইমেইল যাচাই করুন ✅',
    html:    buildHtml(content),
  });
};

// ── Password Reset Email ──────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, name, token) => {
  const link = getFrontend() + '/shop/reset-password?token=' + token;

  const content = ''
    + '<h2 style="color:#111;margin:0 0 12px;font-size:20px;">হ্যালো, ' + name + '!</h2>'
    + '<p style="color:#555;line-height:1.7;margin:0 0 20px;">'
    + 'পাসওয়ার্ড রিসেটের অনুরোধ পাওয়া গেছে।'
    + ' নিচের বাটনে ক্লিক করে নতুন পাসওয়ার্ড দিন।</p>'
    + '<div style="text-align:center;margin:24px 0;">'
    + '<a href="' + link + '"'
    + ' style="background:#10b981;color:#fff;padding:14px 36px;border-radius:8px;'
    + 'text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">'
    + '🔑 নতুন পাসওয়ার্ড দিন</a></div>'
    + '<p style="color:#888;font-size:12px;margin:0 0 6px;">বাটন কাজ না করলে এই লিংক copy করুন:</p>'
    + '<p style="background:#f5f5f5;border-radius:6px;padding:10px;font-size:11px;'
    + 'color:#555;word-break:break-all;margin:0 0 16px;">' + link + '</p>'
    + '<div style="background:#fff1f2;border:1px solid #fca5a5;border-radius:8px;padding:12px;">'
    + '<p style="color:#991b1b;font-size:12px;margin:0;">'
    + '⏰ এই link <strong>১ ঘণ্টা</strong> valid।'
    + ' আপনি অনুরোধ না করলে এই email উপেক্ষা করুন।</p></div>';

  await sendEmail({
    to:      email,
    subject: 'MiniBazar ERP — পাসওয়ার্ড রিসেট করুন 🔑',
    html:    buildHtml(content),
  });
};
