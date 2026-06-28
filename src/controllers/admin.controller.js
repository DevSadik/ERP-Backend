import CentralProduct from '../models/CentralProduct.model.js';
import Shop           from '../models/Shop.model.js';

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

// ── Lookup central product by exact barcode ───────────────────────────────────
export const lookupCentralBarcode = async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    console.log('🔍 Barcode lookup request for:', JSON.stringify(code));
    if (!code) return res.json({ success: true, data: null });

    // Exact match first
    let product = await CentralProduct.findOne({ barcode: code });

    // Fallback: match ignoring surrounding whitespace (older/dirty data)
    if (!product) {
      product = await CentralProduct.findOne({
        barcode: new RegExp('^\\s*' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'),
      });
    }

    console.log(product ? `✅ Found: ${product.name}` : '❌ Not found in central catalog');
    if (!product) return res.json({ success: true, data: null });
    ok(res, product);
  } catch (e) { next(e); }
};

// ── List central products ─────────────────────────────────────────────────────
export const listCentral = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name: new RegExp(search,'i') }, { barcode: new RegExp(search,'i') },
      { company: new RegExp(search,'i') }, { category: new RegExp(search,'i') },
    ];
    const skip = (Math.max(1,+page)-1) * +limit;
    const [data, total] = await Promise.all([
      CentralProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
      CentralProduct.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page:+page, total, pages: Math.ceil(total/+limit) } });
  } catch (e) { next(e); }
};

// ── Create central product ─────────────────────────────────────────────────────
export const createCentral = async (req, res, next) => {
  try {
    const { name, company, category, unit, mrp, description } = req.body;
    const barcode = req.body.barcode ? String(req.body.barcode).trim() : '';
    if (!name) return err(res, 400, 'পণ্যের নাম প্রয়োজন।');

    // Duplicate barcode is NOT allowed. If it already exists, tell the client
    // and send back the existing product so the form can show "already exists".
    if (barcode) {
      const existing = await CentralProduct.findOne({ barcode });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'এই বারকোড আগে থেকেই আছে।',
          data: existing,
        });
      }
    }

    const product = await CentralProduct.create({
      name,
      company:     company  || '',
      category:    category || 'General',
      barcode:     barcode  || undefined,
      unit:        unit || 'pcs',
      mrp:         +mrp || 0,
      description: description || '',
    });
    res.status(201).json({ success: true, message: 'কেন্দ্রীয় পণ্য যোগ হয়েছে।', data: product });
  } catch (e) { next(e); }
};

// ── Update central product ─────────────────────────────────────────────────────
export const updateCentral = async (req, res, next) => {
  try {
    const allowed = ['name','company','category','unit','mrp','barcode','description','isActive'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (updates.mrp !== undefined) updates.mrp = +updates.mrp;

    const product = await CentralProduct.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) return err(res, 404, 'পণ্য পাওয়া যায়নি।');
    ok(res, product, 'আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

// ── Delete central product ─────────────────────────────────────────────────────
export const deleteCentral = async (req, res, next) => {
  try {
    await CentralProduct.findByIdAndDelete(req.params.id);
    ok(res, null, 'পণ্য মুছে গেছে।');
  } catch (e) { next(e); }
};

// ── Central meta (categories + companies for dropdowns) ───────────────────────
export const getCentralMeta = async (req, res, next) => {
  try {
    const [categories, companies] = await Promise.all([
      CentralProduct.distinct('category'),
      CentralProduct.distinct('company'),
    ]);
    ok(res, { categories: categories.filter(Boolean), companies: companies.filter(Boolean) });
  } catch (e) { next(e); }
};

// ── List shops ──────────────────────────────────────────────────────────────
export const listShops = async (req, res, next) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 }).select('-password');
    ok(res, shops);
  } catch (e) { next(e); }
};

// ── Update shop plan (trial → pro/basic, extend expiry, activate/deactivate) ──
export const updateShopPlan = async (req, res, next) => {
  try {
    const { plan, months, isActive } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return err(res, 404, 'দোকান পাওয়া যায়নি।');

    const updates = {};

    if (plan) {
      if (!['trial','basic','pro'].includes(plan))
        return err(res, 400, 'ভুল plan।');
      updates.plan = plan;

      // Set expiry for paid plans
      if (plan === 'pro' || plan === 'basic') {
        const addMonths = +months || 1;
        // Extend from current expiry if still valid, else from now
        const base = (shop.planExpires && shop.planExpires > new Date())
          ? new Date(shop.planExpires)
          : new Date();
        base.setMonth(base.getMonth() + addMonths);
        updates.planExpires = base;
      }
    }

    if (typeof isActive === 'boolean') updates.isActive = isActive;

    const updated = await Shop.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    ok(res, updated, 'দোকানের plan আপডেট হয়েছে।');
  } catch (e) { next(e); }
};
