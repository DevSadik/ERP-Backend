import crypto from 'crypto';
import jwt    from 'jsonwebtoken';
import Shop   from '../models/Shop.model.js';
import { sendOtpSMS } from '../utils/smsService.js';
import logger from '../utils/logger.js';

const signToken = (id) => jwt.sign(
  { id, type: 'shop' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '15d' }
);

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

// Generate 6-digit OTP
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ── Register ──────────────────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { shopName, ownerName, email, password, phone, address, businessType } = req.body;

    if (!shopName?.trim() || !ownerName?.trim() || !phone?.trim() || !password)
      return err(res, 400, 'সব তথ্য পূরণ করুন (দোকান, মালিক, ফোন, পাসওয়ার্ড)।');
    if (password.length < 6)
      return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।');

    // Normalize phone
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01'))
      return err(res, 400, 'সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।');

    // Check duplicate phone
    const exists = await Shop.findOne({ phone: cleanPhone });
    if (exists) return err(res, 409, 'এই নম্বরে আগেই অ্যাকাউন্ট আছে।');

    // Check duplicate email if provided
    if (email?.trim()) {
      const emailExists = await Shop.findOne({ email: email.toLowerCase().trim() });
      if (emailExists) return err(res, 409, 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে।');
    }

    const otp        = genOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // TEST MODE: show OTP in terminal (until SMS account is live)
    if (process.env.SMS_TEST_MODE === 'true') {
      logger.info('========================================');
      logger.info('🔑 TEST MODE OTP for ' + phone + ' → ' + otp);
      logger.info('========================================');
    }

    const shop = await Shop.create({
      name:            shopName.trim(),
      ownerName:       ownerName.trim(),
      email:           email?.toLowerCase().trim() || `${cleanPhone}@minimanager.local`,
      password,
      phone:           cleanPhone,
      address:         address?.trim(),
      businessType:    businessType || 'মিষ্টান্ন',
      isPhoneVerified: false,
      phoneOtp:        otp,
      phoneOtpExpires: otpExpires,
    });

    // Send OTP via SMS
    let smsStatus = 'sent';
    let smsDetail = '';
    try {
      const result = await sendOtpSMS(cleanPhone, otp);
      smsDetail = JSON.stringify(result);
      logger.info('OTP sent to ' + cleanPhone + ' | ' + smsDetail);
    } catch (smsErr) {
      smsStatus = 'failed';
      smsDetail = smsErr.message;
      logger.error('OTP SMS failed: ' + smsErr.message);
    }

    ok(res, { phone: cleanPhone, shopId: shop._id, smsStatus, smsDetail },
       smsStatus === 'sent'
         ? 'রেজিস্ট্রেশন সফল! আপনার মোবাইলে OTP পাঠানো হয়েছে।'
         : 'রেজিস্ট্রেশন হয়েছে কিন্তু SMS পাঠানো যায়নি: ' + smsDetail);
  } catch (e) { next(e); }
};

// ── Verify OTP ────────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return err(res, 400, 'ফোন ও OTP দিন।');

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');

    const shop = await Shop.findOne({ phone: cleanPhone });
    if (!shop) return err(res, 404, 'অ্যাকাউন্ট পাওয়া যায়নি।');

    if (shop.isPhoneVerified)
      return err(res, 400, 'এই নম্বর আগেই যাচাই হয়েছে। লগইন করুন।');

    if (shop.phoneOtp !== String(otp).trim())
      return err(res, 400, 'OTP ভুল হয়েছে।');

    if (shop.phoneOtpExpires < new Date())
      return err(res, 400, 'OTP-এর মেয়াদ শেষ। নতুন OTP নিন।');

    await Shop.updateOne(
      { _id: shop._id },
      { $set: { isPhoneVerified: true }, $unset: { phoneOtp: '', phoneOtpExpires: '' } }
    );

    const token     = signToken(shop._id);
    const safeShop  = await Shop.findById(shop._id).select('-password -phoneOtp -phoneOtpExpires');
    ok(res, { token, shop: safeShop }, 'মোবাইল যাচাই সফল!');
  } catch (e) { next(e); }
};

// ── Resend OTP ────────────────────────────────────────────────────────────────
export const resendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return err(res, 400, 'ফোন নম্বর দিন।');

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');
    const shop = await Shop.findOne({ phone: cleanPhone });
    if (!shop)              return err(res, 404, 'অ্যাকাউন্ট পাওয়া যায়নি।');
    if (shop.isPhoneVerified) return err(res, 400, 'নম্বর আগেই যাচাই হয়েছে।');

    const otp = genOtp();
    await Shop.updateOne(
      { _id: shop._id },
      { $set: { phoneOtp: otp, phoneOtpExpires: new Date(Date.now() + 10 * 60 * 1000) } }
    );

    if (process.env.SMS_TEST_MODE === 'true') {
      logger.info('🔑 TEST MODE OTP (resend) for ' + cleanPhone + ' → ' + otp);
    }

    await sendOtpSMS(cleanPhone, otp);
    ok(res, { phone: cleanPhone }, 'নতুন OTP পাঠানো হয়েছে।');
  } catch (e) { next(e); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return err(res, 400, 'ফোন নম্বর ও পাসওয়ার্ড দিন।');

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');
    const shop = await Shop.findOne({ phone: cleanPhone }).select('+password');
    if (!shop || !(await shop.comparePassword(password)))
      return err(res, 401, 'ফোন নম্বর বা পাসওয়ার্ড ভুল।');

    if (!shop.isActive)
      return err(res, 403, 'অ্যাকাউন্ট নিষ্ক্রিয়।');

    if (!shop.isPhoneVerified)
      return err(res, 403, JSON.stringify({
        code:    'PHONE_NOT_VERIFIED',
        phone:   shop.phone,
        message: 'মোবাইল যাচাই করা হয়নি। OTP দিয়ে যাচাই করুন।',
      }));

    await Shop.updateOne({ _id: shop._id }, { $set: { lastLogin: new Date() } });
    const token = signToken(shop._id);
    shop.password = undefined;
    ok(res, { token, shop }, 'লগইন সফল।');
  } catch (e) { next(e); }
};

// ── Forgot Password (send OTP) ────────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return err(res, 400, 'ফোন নম্বর দিন।');

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');
    const shop = await Shop.findOne({ phone: cleanPhone });
    if (!shop) return ok(res, null, 'যদি এই নম্বরে অ্যাকাউন্ট থাকে, OTP পাঠানো হবে।');

    const otp = genOtp();
    await Shop.updateOne(
      { _id: shop._id },
      { $set: { phoneOtp: otp, phoneOtpExpires: new Date(Date.now() + 10 * 60 * 1000) } }
    );

    if (process.env.SMS_TEST_MODE === 'true') {
      logger.info('🔑 TEST MODE OTP (reset) for ' + cleanPhone + ' → ' + otp);
    }

    try {
      await sendOtpSMS(cleanPhone, otp);
    } catch (smsErr) {
      logger.error('Reset OTP SMS failed: ' + smsErr.message);
      return err(res, 500, 'OTP পাঠানো ব্যর্থ। পরে চেষ্টা করুন।');
    }

    ok(res, { phone: cleanPhone }, 'পাসওয়ার্ড রিসেট OTP পাঠানো হয়েছে।');
  } catch (e) { next(e); }
};

// ── Reset Password (verify OTP + set new password) ────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    const { phone, otp, password } = req.body;
    if (!phone || !otp || !password)
      return err(res, 400, 'ফোন, OTP ও নতুন পাসওয়ার্ড দিন।');
    if (password.length < 6)
      return err(res, 400, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর।');

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^88/, '');
    const shop = await Shop.findOne({ phone: cleanPhone });
    if (!shop) return err(res, 404, 'অ্যাকাউন্ট পাওয়া যায়নি।');

    if (String(shop.phoneOtp).trim() !== String(otp).trim())
      return err(res, 400, 'OTP ভুল হয়েছে।');
    if (new Date(shop.phoneOtpExpires) < new Date())
      return err(res, 400, 'OTP-এর মেয়াদ শেষ। নতুন OTP নিন।');

    shop.password = password;
    await shop.save();
    await Shop.updateOne(
      { _id: shop._id },
      { $unset: { phoneOtp: '', phoneOtpExpires: '' } }
    );

    const token    = signToken(shop._id);
    const safeShop = await Shop.findById(shop._id).select('-password');
    ok(res, { token, shop: safeShop }, 'পাসওয়ার্ড পরিবর্তন সফল।');
  } catch (e) { next(e); }
};
