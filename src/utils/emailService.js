import nodemailer from 'nodemailer';

const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const FRONTEND = process.env.FRONTEND_URL || 'https://erp-forntend-ruddy.vercel.app/';

const emailTemplate = (title, content) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#f9f9f9;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10b981,#065f46);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">MiniBazar ERP</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">মিষ্টান্ন ইনভেন্টরি ম্যানেজমেন্ট</p>
    </div>
    <div style="padding:32px;">
      ${content}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#bbb;font-size:11px;text-align:center;">© 2026 MiniBazar ERP by Wahidsadik Aditto. All rights reserved.</p>
    </div>
  </div>
`;

export const sendVerificationEmail = async (email, name, token) => {
  const link = `${FRONTEND}/verify-email?token=${token}`;
  await createTransporter().sendMail({
    from: `"MiniBazar ERP" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '✅ MiniBazar ERP — ইমেইল যাচাই করুন',
    html: emailTemplate('ইমেইল যাচাই', `
      <h2 style="color:#111;margin:0 0 12px;">স্বাগতম, ${name}!</h2>
      <p style="color:#444;line-height:1.6;">আপনার MiniBazar ERP অ্যাকাউন্ট তৈরি হয়েছে। ব্যবহার শুরু করতে ইমেইল যাচাই করুন।</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="background:#10b981;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
          ✅ ইমেইল যাচাই করুন
        </a>
      </div>
      <p style="color:#888;font-size:13px;">এই link ২৪ ঘণ্টা পর মেয়াদ শেষ হবে।</p>
    `),
  });
};

export const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${FRONTEND}/shop/reset-password?token=${token}`;
  await createTransporter().sendMail({
    from: `"MiniBazar ERP" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🔑 MiniBazar ERP — পাসওয়ার্ড রিসেট করুন',
    html: emailTemplate('পাসওয়ার্ড রিসেট', `
      <h2 style="color:#111;margin:0 0 12px;">হ্যালো, ${name}!</h2>
      <p style="color:#444;line-height:1.6;">আপনি পাসওয়ার্ড রিসেটের অনুরোধ করেছেন। নিচের বাটনে ক্লিক করুন।</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="background:#10b981;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
          🔑 নতুন পাসওয়ার্ড দিন
        </a>
      </div>
      <p style="color:#888;font-size:13px;">এই link ১ ঘণ্টা পর মেয়াদ শেষ হবে।</p>
      <p style="color:#888;font-size:13px;">আপনি এই অনুরোধ না করলে এই email উপেক্ষা করুন।</p>
    `),
  });
};
