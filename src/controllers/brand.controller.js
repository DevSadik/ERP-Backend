const jwt = require('jsonwebtoken');
const { Brand, RegistryProduct } = require('../models');

const signToken = id => jwt.sign({ id, type: 'brand' }, process.env.JWT_SECRET, { expiresIn: '7d' });

const respond = (res, status, data, message = 'OK') =>
  res.status(status).json({ success: true, message, data });

// ── Auth ──────────────────────────────────────────────────────────────────────
exports.brandRegister = async (req, res, next) => {
  try {
    const { companyName, email, password, phone, address, tradeCategory, description } = req.body;
    const exists = await Brand.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'এই ইমেইল দিয়ে আগেই রেজিস্ট্রেশন হয়েছে।' });
    const brand = await Brand.create({ companyName, email, password, phone, address, tradeCategory, description, logo: req.file?.filename });
    brand.password = undefined;
    respond(res, 201, brand, 'রেজিস্ট্রেশন সফল। অ্যাডমিন অনুমোদনের পর লগইন করতে পারবেন।');
  } catch (e) { next(e); }
};

exports.brandLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const brand = await Brand.findOne({ email }).select('+password');
    if (!brand || !(await brand.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'ইমেইল বা পাসওয়ার্ড ভুল।' });
    if (brand.status === 'pending')
      return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্ট এখনো অনুমোদন পায়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।' });
    if (brand.status === 'rejected')
      return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্ট অনুমোদিত হয়নি।' });
    if (brand.status === 'suspended')
      return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে।' });
    brand.lastLogin = new Date();
    await brand.save({ validateBeforeSave: false });
    const token = signToken(brand._id);
    brand.password = undefined;
    respond(res, 200, { token, brand }, 'লগইন সফল।');
  } catch (e) { next(e); }
};

exports.brandMe = async (req, res) => respond(res, 200, req.brand);

exports.brandUpdateProfile = async (req, res, next) => {
  try {
    const allowed = ['companyName', 'phone', 'address', 'website', 'description', 'tradeCategory'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (req.file) updates.logo = req.file.filename;
    const brand = await Brand.findByIdAndUpdate(req.brand._id, updates, { new: true });
    respond(res, 200, brand, 'প্রোফাইল আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

// ── Products ──────────────────────────────────────────────────────────────────
exports.brandGetProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const filter = { brand: req.brand._id };
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
      { category: new RegExp(search, 'i') },
    ];
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const lim  = Math.min(100, +limit);
    const [products, total] = await Promise.all([
      RegistryProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      RegistryProduct.countDocuments(filter),
    ]);
    res.json({ success: true, data: products, meta: { page: +page, limit: lim, total, pages: Math.ceil(total / lim) } });
  } catch (e) { next(e); }
};

exports.brandCreateProduct = async (req, res, next) => {
  try {
    const { barcode, name, nameBn, category, unit, mrp, tradePrice, pcsPerCarton, weight, description } = req.body;
    const exists = await RegistryProduct.findOne({ barcode, brand: req.brand._id });
    if (exists) return res.status(409).json({ success: false, message: 'এই বারকোড দিয়ে আগেই পণ্য আছে।' });
    const images = req.files?.map(f => f.filename) || [];
    const product = await RegistryProduct.create({
      brand: req.brand._id, barcode, name, nameBn, category, unit,
      mrp: +mrp, tradePrice: +tradePrice, pcsPerCarton: +(pcsPerCarton || 1),
      weight, description, images, status: 'pending',
    });
    await Brand.findByIdAndUpdate(req.brand._id, { $inc: { totalProducts: 1 } });
    respond(res, 201, product, 'পণ্য জমা হয়েছে। অ্যাডমিন অনুমোদনের পর সক্রিয় হবে।');
  } catch (e) { next(e); }
};

exports.brandUpdateProduct = async (req, res, next) => {
  try {
    const product = await RegistryProduct.findOne({ _id: req.params.id, brand: req.brand._id });
    if (!product) return res.status(404).json({ success: false, message: 'পণ্য পাওয়া যায়নি।' });
    const allowed = ['name','nameBn','category','unit','mrp','tradePrice','pcsPerCarton','weight','description'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (req.files?.length) updates.images = req.files.map(f => f.filename);
    updates.status = 'pending'; // re-review on edit
    const updated = await RegistryProduct.findByIdAndUpdate(req.params.id, updates, { new: true });
    respond(res, 200, updated, 'পণ্য আপডেট হয়েছে। পুনরায় অনুমোদনের অপেক্ষায়।');
  } catch (e) { next(e); }
};

exports.brandDeleteProduct = async (req, res, next) => {
  try {
    await RegistryProduct.findOneAndUpdate({ _id: req.params.id, brand: req.brand._id }, { isActive: false });
    respond(res, 200, null, 'পণ্য নিষ্ক্রিয় করা হয়েছে।');
  } catch (e) { next(e); }
};

// ── Admin — Brand Management ──────────────────────────────────────────────────
exports.adminGetBrands = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const brands = await Brand.find(filter).sort({ createdAt: -1 });
    respond(res, 200, brands);
  } catch (e) { next(e); }
};

exports.adminApproveBrand = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const brand = await Brand.findByIdAndUpdate(req.params.id, {
      status, isVerified: status === 'approved',
      ...(reason && { rejectedReason: reason })
    }, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });
    respond(res, 200, brand, `Brand ${status}.`);
  } catch (e) { next(e); }
};

exports.adminGetRegistryProducts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const skip = (Math.max(1, +page) - 1) * 20;
    const [products, total] = await Promise.all([
      RegistryProduct.find(filter).populate('brand', 'companyName logo email').sort({ createdAt: -1 }).skip(skip).limit(20),
      RegistryProduct.countDocuments(filter),
    ]);
    res.json({ success: true, data: products, meta: { page: +page, total, pages: Math.ceil(total / 20) } });
  } catch (e) { next(e); }
};

exports.adminApproveProduct = async (req, res, next) => {
  try {
    const { status, rejectedReason } = req.body;
    const product = await RegistryProduct.findByIdAndUpdate(req.params.id, {
      status, ...(rejectedReason && { rejectedReason })
    }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    respond(res, 200, product, `Product ${status}.`);
  } catch (e) { next(e); }
};

// ── Public barcode lookup from registry ───────────────────────────────────────
exports.registryLookup = async (req, res, next) => {
  try {
    const code = req.params.code.trim();
    const product = await RegistryProduct.findOne({
      barcode: code, status: 'active', isActive: true,
    }).populate('brand', 'companyName logo');
    if (!product) return res.status(404).json({ success: false, message: `বারকোড "${code}" পাওয়া যায়নি।` });
    respond(res, 200, product, 'পণ্য পাওয়া গেছে।');
  } catch (e) { next(e); }
};

exports.registrySearch = async (req, res, next) => {
  try {
    const { q, category, brand } = req.query;
    const filter = { status: 'active', isActive: true };
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { barcode: new RegExp(q, 'i') }, { nameBn: new RegExp(q, 'i') }];
    if (category) filter.category = new RegExp(category, 'i');
    if (brand) filter.brand = brand;
    const products = await RegistryProduct.find(filter).populate('brand', 'companyName logo').limit(40);
    respond(res, 200, products);
  } catch (e) { next(e); }
};
