import Product from '../models/Product.model.js';
import Shop    from '../models/Shop.model.js';

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

export const listCentral = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const filter = { isCentral: true };
    if (search) filter.$or = [
      { name: new RegExp(search,'i') }, { barcode: new RegExp(search,'i') },
      { company: new RegExp(search,'i') }, { category: new RegExp(search,'i') },
    ];
    const skip = (Math.max(1,+page)-1) * +limit;
    const [data, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page:+page, total, pages: Math.ceil(total/+limit) } });
  } catch (e) { next(e); }
};

export const createCentral = async (req, res, next) => {
  try {
    const { name, company, category, barcode, unit, mrp } = req.body;
    if (!name || !barcode) return err(res, 400, 'নাম ও বারকোড প্রয়োজন।');
    const dup = await Product.findOne({ isCentral: true, barcode });
    if (dup) return err(res, 409, 'এই বারকোড আগেই আছে।');
    const product = await Product.create({
      sku: `C-${Date.now()}`, name, company: company||'', category: category||'সাধারণ',
      barcode, unit: unit||'pcs', mrp: +mrp||0, salePrice: +mrp||0,
      costPrice: 0, currentStock: 0, isCentral: true, shop: null,
    });
    res.status(201).json({ success: true, message: 'কেন্দ্রীয় পণ্য যোগ হয়েছে।', data: product });
  } catch (e) { next(e); }
};

export const updateCentral = async (req, res, next) => {
  try {
    const allowed  = ['name','company','category','unit','mrp','isActive'];
    const updates  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (updates.mrp !== undefined) updates.salePrice = +updates.mrp;
    const product  = await Product.findOneAndUpdate({ _id: req.params.id, isCentral: true }, updates, { new: true });
    if (!product) return err(res, 404, 'পণ্য পাওয়া যায়নি।');
    ok(res, product, 'আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

export const deleteCentral = async (req, res, next) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, isCentral: true });
    ok(res, null, 'পণ্য মুছে গেছে।');
  } catch (e) { next(e); }
};

export const listShops = async (req, res, next) => {
  try {
    const shops = await Shop.find().sort({ createdAt: -1 }).select('-password');
    ok(res, shops);
  } catch (e) { next(e); }
};

export const getCentralMeta = async (req, res, next) => {
  try {
    const [categories, companies] = await Promise.all([
      Product.distinct('category', { isCentral: true }),
      Product.distinct('company',  { isCentral: true }),
    ]);
    ok(res, { categories: categories.filter(Boolean), companies: companies.filter(Boolean) });
  } catch (e) { next(e); }
};
