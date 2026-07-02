import * as bkash from '../utils/bkashService.js';
import Shop from '../models/Shop.model.js';
import Payment from '../models/Payment.model.js';

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

// Plan prices (BDT) and durations (months)
const PLANS = {
  basic: { price: 500,  months: 1, label: 'Basic (1 month)' },
  pro:   { price: 1000, months: 1, label: 'Pro (1 month)'   },
  pro3:  { price: 2700, months: 3, label: 'Pro (3 months)'  },
  pro6:  { price: 5000, months: 6, label: 'Pro (6 months)'  },
  pro12: { price: 9000, months: 12, label: 'Pro (12 months)' },
};

// ── Start a subscription payment (shopkeeper clicks "Buy Pro") ────────────────
export const startPayment = async (req, res, next) => {
  try {
    if (!bkash.isConfigured())
      return err(res, 503, 'অনলাইন পেমেন্ট এখন বন্ধ। ম্যানুয়াল পেমেন্টের জন্য যোগাযোগ করুন: 01844815121');

    const { planKey } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return err(res, 400, 'ভুল প্ল্যান।');

    const shop = await Shop.findById(req.shopId);
    if (!shop) return err(res, 404, 'দোকান পাওয়া যায়নি।');

    const invoice = `MM-${req.shopId.toString().slice(-6)}-${Date.now()}`;
    const callbackURL = `${process.env.BACKEND_URL || ''}/api/v1/payment/callback`;

    const created = await bkash.createPayment({
      amount: plan.price,
      invoice,
      payerRef: shop.phone || ' ',
      callbackURL,
    });

    if (!created.paymentID || !created.bkashURL)
      return err(res, 502, created.statusMessage || 'bKash পেমেন্ট তৈরি ব্যর্থ।');

    // Record the pending payment so the callback can finish it
    await Payment.create({
      shop: req.shopId,
      paymentID: created.paymentID,
      invoice,
      planKey,
      amount: plan.price,
      months: plan.months,
      status: 'pending',
    });

    // Frontend redirects the user to this bKash URL
    ok(res, { bkashURL: created.bkashURL, paymentID: created.paymentID }, 'পেমেন্ট পেজে যান।');
  } catch (e) { next(e); }
};

// ── bKash callback (after user finishes payment on bKash page) ────────────────
export const paymentCallback = async (req, res, next) => {
  try {
    const { paymentID, status } = req.query;
    const FRONT = process.env.FRONTEND_URL || '/';

    if (!paymentID || status !== 'success') {
      return res.redirect(`${FRONT}/profile?payment=cancelled`);
    }

    // Execute & verify the payment with bKash
    const exec = await bkash.executePayment(paymentID);
    const paid = exec.transactionStatus === 'Completed' || exec.statusCode === '0000';

    const record = await Payment.findOne({ paymentID });
    if (!record) return res.redirect(`${FRONT}/profile?payment=error`);

    if (!paid) {
      record.status = 'failed';
      await record.save();
      return res.redirect(`${FRONT}/profile?payment=failed`);
    }

    // ── Payment success → activate THIS shop's subscription ──
    record.status = 'completed';
    record.trxId  = exec.trxID || '';
    await record.save();

    const shop = await Shop.findById(record.shop);
    if (shop) {
      const planType = record.planKey.startsWith('pro') ? 'pro' : 'basic';
      // Extend from current expiry if still active, else from now
      const base = (shop.planExpires && shop.planExpires > Date.now())
        ? new Date(shop.planExpires)
        : new Date();
      base.setMonth(base.getMonth() + record.months);
      shop.plan = planType;
      shop.planExpires = base;
      shop.isActive = true;
      await shop.save();
    }

    return res.redirect(`${FRONT}/profile?payment=success`);
  } catch (e) {
    const FRONT = process.env.FRONTEND_URL || '/';
    return res.redirect(`${FRONT}/profile?payment=error`);
  }
};

// ── List available plans (for the frontend) ───────────────────────────────────
export const getPlans = async (req, res) => {
  const online = bkash.isConfigured();
  ok(res, { plans: PLANS, onlinePayment: online, manualNumber: '01844815121' });
};
