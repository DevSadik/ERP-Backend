import crypto from 'crypto';
import jwt    from 'jsonwebtoken';
import Shop   from '../models/Shop.model.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';

const signToken = (id) => jwt.sign(
  { id, type: 'shop' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

// ── Register ──────────────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { shopName, ownerName, email, password, phone, address, businessType } = req.body;

    if (!shopName?.trim() || !ownerName?.trim() || !email?.trim() || !password)
      return err(res, 400, 'সব তথ্য পূরণ করুন।');
    if (password.length < 6)
      return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।');

    const exists = await Shop.findOne({ email: email.toLowerCase().trim() });
    if (exists) return err(res, 409, 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে।');

    // Generate token before creating shop
    const verifyToken   = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const shop = await Shop.create({
      name:               shopName.trim(),
      ownerName:          ownerName.trim(),
      email:              email.toLowerCase().trim(),
      password,
      phone:              phone?.trim(),
      address:            address?.trim(),
      businessType:       businessType || 'মিষ্টান্ন',
      isEmailVerified:    false,
      emailVerifyToken:   verifyToken,
      emailVerifyExpires: verifyExpires,
    });

    // Send verification email
    try {
      await sendVerificationEmail(shop.email, shop.ownerName, verifyToken);
      logger.info(`Verification email sent to ${shop.email}`);
    } catch (mailErr) {
      logger.error('Email send failed:', mailErr.message);
      // Don't fail registration if email fails
    }

    shop.password = undefined;
    ok(res, { shop }, '✅ রেজিস্ট্রেশন সফল! ইমেইলে যাচাই লিংক পাঠানো হয়েছে।');
  } catch (e) { next(e); }
};

// ── Verify Email ──────────────────────────────────────────────────────────────
export const verifyEmail = async (req, res, next) => {
  try {
    const token = req.params.token?.trim();
    if (!token) return err(res, 400, 'Token পাওয়া যায়নি।');

    logger.info(`Email verify attempt with token: ${token.slice(0,8)}...`);

    // Find shop with matching token that hasn't expired
    const shop = await Shop.findOne({
      emailVerifyToken:   token,
      emailVerifyExpires: { $gt: new Date() },
    });

    if (!shop) {
      // Check if already verified (user clicked link twice)
      const alreadyVerified = await Shop.findOne({
        isEmailVerified: true,
        emailVerifyToken: { $exists: false },
      });

      logger.warn(`Verify failed - token not found or expired`);
      return err(res, 400, 'যাচাই লিংক অবৈধ বা মেয়াদ শেষ হয়েছে। নতুন লিংক নিন।');
    }

    // ✅ Use updateOne to properly unset token fields
    await Shop.updateOne(
      { _id: shop._id },
      {
        $set:   { isEmailVerified: true },
        $unset: { emailVerifyToken: '', emailVerifyExpires: '' },
      }
    );

    logger.info(`Email verified for shop: ${shop.email}`);

    // Return JWT so user is auto-logged in
    const jwtToken = signToken(shop._id);

    // Get updated shop (without sensitive fields)
    const updatedShop = await Shop.findById(shop._id).select('-password -emailVerifyToken -emailVerifyExpires -passwordResetToken -passwordResetExpires');

    ok(res, { token: jwtToken, shop: updatedShop }, '✅ ইমেইল যাচাই সফল! আপনাকে স্বাগতম।');
  } catch (e) { next(e); }
};

// ── Resend Verification ───────────────────────────────────────────────────────
export const resendVerification = async (req, res, next) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email) return err(res, 400, 'ইমেইল দিন।');

    const shop = await Shop.findOne({ email });
    if (!shop)           return err(res, 404, 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই।');
    if (shop.isEmailVerified) return err(res, 400, 'ইমেইল আগেই যাচাই হয়েছে।');

    const verifyToken   = crypto.randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await Shop.updateOne(
      { _id: shop._id },
      { $set: { emailVerifyToken: verifyToken, emailVerifyExpires: verifyExpires } }
    );

    await sendVerificationEmail(shop.email, shop.ownerName, verifyToken);
    ok(res, null, '✅ নতুন যাচাই লিংক পাঠানো হয়েছে।');
  } catch (e) { next(e); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 400, 'ইমেইল ও পাসওয়ার্ড দিন।');

    const shop = await Shop.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!shop || !(await shop.comparePassword(password)))
      return err(res, 401, 'ইমেইল বা পাসওয়ার্ড ভুল।');

    if (!shop.isActive)
      return err(res, 403, 'অ্যাকাউন্ট নিষ্ক্রিয়।');

    if (!shop.isEmailVerified)
      return err(res, 403, JSON.stringify({
        code: 'EMAIL_NOT_VERIFIED',
        email: shop.email,
        message: 'ইমেইল যাচাই করা হয়নি। আপনার Gmail চেক করুন।',
      }));

    await Shop.updateOne({ _id: shop._id }, { $set: { lastLogin: new Date() } });

    const token = signToken(shop._id);
    shop.password = undefined;
    ok(res, { token, shop }, '✅ লগইন সফল।');
  } catch (e) { next(e); }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const shop  = await Shop.findOne({ email });

    // Always respond success (security)
    if (!shop) return ok(res, null, 'যদি এই ইমেইলে অ্যাকাউন্ট থাকে, reset লিংক পাঠানো হবে।');

    const resetToken   = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await Shop.updateOne(
      { _id: shop._id },
      { $set: { passwordResetToken: resetToken, passwordResetExpires: resetExpires } }
    );

    try {
      await sendPasswordResetEmail(shop.email, shop.ownerName, resetToken);
    } catch (mailErr) {
      await Shop.updateOne(
        { _id: shop._id },
        { $unset: { passwordResetToken: '', passwordResetExpires: '' } }
      );
      return err(res, 500, 'ইমেইল পাঠানো ব্যর্থ। পরে আবার চেষ্টা করুন।');
    }

    ok(res, null, '✅ পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে।');
  } catch (e) { next(e); }
};

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const token    = req.params.token?.trim();
    const { password } = req.body;

    if (!password || password.length < 6)
      return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।');

    const shop = await Shop.findOne({
      passwordResetToken:   token,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!shop) return err(res, 400, 'রিসেট লিংক অবৈধ বা মেয়াদ শেষ।');

    // Update password and clear reset tokens
    shop.password = password;
    await shop.save(); // must use save() for bcrypt pre-save hook

    await Shop.updateOne(
      { _id: shop._id },
      { $unset: { passwordResetToken: '', passwordResetExpires: '' } }
    );

    const jwtToken = signToken(shop._id);
    const updatedShop = await Shop.findById(shop._id).select('-password');
    ok(res, { token: jwtToken, shop: updatedShop }, '✅ পাসওয়ার্ড পরিবর্তন সফল।');
  } catch (e) { next(e); }
};
