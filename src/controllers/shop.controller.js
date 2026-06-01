const jwt      = require('jsonwebtoken');
const { Shop, Product, StockIn, StockOut, CreditLedger, Supplier, Notification } = require('../models');

const signToken = id => jwt.sign({ id, type: 'shop' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const respond = (res, status, data, message = 'OK') =>
  res.status(status).json({ success: true, message, data });

// ── Registration ──────────────────────────────────────────────────────────────
exports.shopRegister = async (req, res, next) => {
  try {
    const { shopName, ownerName, email, password, phone, address, businessType } = req.body;

    if (!shopName || !ownerName || !email || !password)
      return res.status(400).json({ success: false, message: 'সব তথ্য পূরণ করুন।' });

    const exists = await Shop.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ success: false, message: 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে।' });

    const shop = await Shop.create({
      name: shopName, ownerName, email, password,
      phone, address,
      businessType: businessType || 'মিষ্টান্ন',
    });

    const token = signToken(shop._id);
    shop.password = undefined;
    respond(res, 201, { token, shop }, 'রেজিস্ট্রেশন সফল! ১৫ দিনের ফ্রি ট্রায়াল শুরু হয়েছে।');
  } catch (e) { next(e); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.shopLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'ইমেইল ও পাসওয়ার্ড দিন।' });

    const shop = await Shop.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!shop || !(await shop.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'ইমেইল বা পাসওয়ার্ড ভুল।' });

    if (!shop.isActive)
      return res.status(403).json({ success: false, message: 'অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।' });

    shop.lastLogin = new Date();
    await shop.save({ validateBeforeSave: false });

    const token = signToken(shop._id);
    shop.password = undefined;
    respond(res, 200, { token, shop }, 'লগইন সফল।');
  } catch (e) { next(e); }
};

// ── Get me ────────────────────────────────────────────────────────────────────
exports.shopMe = async (req, res) => respond(res, 200, req.shop);

// ── Update profile ────────────────────────────────────────────────────────────
exports.shopUpdateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'ownerName', 'phone', 'address', 'businessType'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (req.file) updates.logo = req.file.filename;
    const shop = await Shop.findByIdAndUpdate(req.shop._id, updates, { new: true });
    respond(res, 200, shop, 'প্রোফাইল আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

// ── Change password ───────────────────────────────────────────────────────────
exports.shopChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const shop = await Shop.findById(req.shop._id).select('+password');
    if (!(await shop.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'বর্তমান পাসওয়ার্ড ভুল।' });
    shop.password = newPassword;
    await shop.save();
    respond(res, 200, null, 'পাসওয়ার্ড পরিবর্তন হয়েছে।');
  } catch (e) { next(e); }
};

// ── Dashboard stats (shop-isolated) ──────────────────────────────────────────
exports.shopDashboardStats = async (req, res, next) => {
  try {
    const shopId    = req.shop._id;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

    const [todaySales, todayOrders, totalProducts, lowStock, inventoryValue, recentOrders] = await Promise.all([
      StockOut.aggregate([
        { $match: { shop: shopId, createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      StockOut.countDocuments({ shop: shopId, createdAt: { $gte: todayStart } }),
      Product.countDocuments({ shop: shopId, isActive: true }),
      Product.countDocuments({ shop: shopId, isActive: true, $expr: { $lte: ['$currentStock', '$reorderLevel'] } }),
      Product.aggregate([
        { $match: { shop: shopId, isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock', '$costPrice'] } } } },
      ]),
      StockOut.find({ shop: shopId }).sort({ createdAt: -1 }).limit(10)
        .select('orderId customer totalAmount paymentType createdAt'),
    ]);

    respond(res, 200, {
      todaySales:     todaySales[0]?.total || 0,
      todayOrders,
      totalProducts,
      lowStockCount:  lowStock,
      inventoryValue: inventoryValue[0]?.total || 0,
      recentOrders,
    });
  } catch (e) { next(e); }
};

// ── Weekly sales chart ────────────────────────────────────────────────────────
exports.shopWeeklySales = async (req, res, next) => {
  try {
    const shopId = req.shop._id;
    const days   = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const end = new Date(d); end.setHours(23,59,59,999);
      const [agg] = await StockOut.aggregate([
        { $match: { shop: shopId, createdAt: { $gte: d, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]);
      days.push({ date: d.toISOString().split('T')[0], total: agg?.total || 0, count: agg?.count || 0 });
    }
    respond(res, 200, days);
  } catch (e) { next(e); }
};

// ── Products (shop-isolated) ──────────────────────────────────────────────────
exports.shopGetProducts = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const filter = { shop: req.shop._id, isActive: true };
    if (search)   filter.$or = [{ name: new RegExp(search,'i') }, { barcode: new RegExp(search,'i') }, { sku: new RegExp(search,'i') }];
    if (category) filter.category = new RegExp(category,'i');
    const skip = (Math.max(1,+page)-1)*Math.min(100,+limit);
    const lim  = Math.min(100,+limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(lim),
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, data: products, meta: { page:+page, limit:lim, total, pages: Math.ceil(total/lim) } });
  } catch (e) { next(e); }
};

exports.shopCreateProduct = async (req, res, next) => {
  try {
    // Check if barcode already exists for this shop
    if (req.body.barcode) {
      const dup = await Product.findOne({ shop: req.shop._id, barcode: req.body.barcode });
      if (dup) return res.status(409).json({ success: false, message: 'এই বারকোড দিয়ে পণ্য আগেই আছে।' });
    }
    const sku = req.body.sku || `SKU-${Date.now()}`;
    const product = await Product.create({ ...req.body, sku, shop: req.shop._id });
    respond(res, 201, product, 'পণ্য তৈরি হয়েছে।');
  } catch (e) { next(e); }
};

exports.shopUpdateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shop: req.shop._id },
      req.body, { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'পণ্য পাওয়া যায়নি।' });
    respond(res, 200, product, 'পণ্য আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

exports.shopDeleteProduct = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, shop: req.shop._id }, { isActive: false });
    respond(res, 200, null, 'পণ্য নিষ্ক্রিয় করা হয়েছে।');
  } catch (e) { next(e); }
};

// ── Barcode lookup: own shop first, then central/admin products ───────────────
exports.shopBarcodeLookup = async (req, res, next) => {
  try {
    const code  = req.params.code.trim();
    const shopId = req.shop._id;

    // 1. Own shop product
    let product = await Product.findOne({ shop: shopId, isActive: true, $or: [{ barcode: code }, { sku: code.toUpperCase() }] });
    if (product) return respond(res, 200, { ...product.toJSON(), source: 'own' }, 'নিজের ডেটাবেজে পাওয়া গেছে।');

    // 2. Central/Admin product catalogue (isCentral = true)
    //    OPTION A: only expose name, company, category, MRP, barcode, unit
    //    Cost price is NEVER sent. Shop owner enters their own cost & sale price.
    product = await Product.findOne({ isCentral: true, isActive: true, $or: [{ barcode: code }, { sku: code.toUpperCase() }] });
    if (product) return respond(res, 200, {
      _id:       null,
      name:      product.name,
      company:   product.company || '',
      category:  product.category,
      barcode:   product.barcode,
      unit:      product.unit,
      mrp:       product.mrp || product.salePrice || 0,
      salePrice: product.mrp || product.salePrice || 0,  // suggested = MRP (locked)
      costPrice: '',     // shop enters own
      source:    'central',
    }, 'কেন্দ্রীয় ডেটাবেজে পাওয়া গেছে।');

    // 3. Global registry (supplier uploaded)
    const { RegistryProduct } = require('../models');
    const reg = await RegistryProduct.findOne({ barcode: code, status: 'active', isActive: true }).populate('brand','companyName');
    if (reg) return respond(res, 200, {
      _id: null, barcode: reg.barcode, name: reg.name, nameBn: reg.nameBn,
      sku: '', unit: reg.unit, costPrice: reg.tradePrice, salePrice: reg.mrp,
      category: reg.category, images: reg.images, brandName: reg.brand?.companyName,
      pcsPerCarton: reg.pcsPerCarton, source: 'registry',
    }, 'গ্লোবাল রেজিস্ট্রিতে পাওয়া গেছে।');

    return res.status(404).json({ success: false, message: `বারকোড "${code}" পাওয়া যায়নি।` });
  } catch (e) { next(e); }
};

// ── Stock In ──────────────────────────────────────────────────────────────────
exports.shopGetStockIn = async (req, res, next) => {
  try {
    const { page=1, limit=15, status } = req.query;
    const filter = { shop: req.shop._id };
    if (status) filter.status = status;
    const skip = (Math.max(1,+page)-1)*15;
    const [items, total] = await Promise.all([
      StockIn.find(filter).populate('product','name sku unit barcode').sort({ createdAt:-1 }).skip(skip).limit(15),
      StockIn.countDocuments(filter),
    ]);
    res.json({ success:true, data:items, meta:{ page:+page, total, pages: Math.ceil(total/15) } });
  } catch (e) { next(e); }
};

exports.shopCreateStockIn = async (req, res, next) => {
  try {
    const { product: productId, quantity, supplier, costTotal, notes, status } = req.body;
    const shopId = req.shop._id;

    // If new product data provided, create it first
    if (!productId && req.body.productName) {
      // Avoid duplicates: if this shop already has a product with this barcode, reuse it
      let existing = null;
      if (req.body.barcode) {
        existing = await Product.findOne({ shop: shopId, barcode: req.body.barcode });
      }
      if (existing) {
        // Update to the latest entered values
        existing.costPrice = req.body.costPrice || existing.costPrice;
        existing.salePrice = req.body.salePrice || existing.salePrice;
        if (req.body.category) existing.category = req.body.category;
        if (req.body.mrp)      existing.mrp = +req.body.mrp;
        await existing.save();
        req.body.product = existing._id;
      } else {
        const newProd = await Product.create({
          sku:          req.body.sku || `SKU-${Date.now()}`,
          name:         req.body.productName,
          barcode:      req.body.barcode,
          company:      req.body.company || '',
          mrp:          +req.body.mrp || 0,
          category:     req.body.category || 'সাধারণ',
          unit:         req.body.unit || 'pcs',
          costPrice:    req.body.costPrice || 0,
          salePrice:    req.body.salePrice || 0,
          reorderLevel: req.body.reorderLevel || 50,
          currentStock: 0,
          isCentral:    false,
          shop:         shopId,
        });
        req.body.product = newProd._id;
      }
    }

    const batchNo = `SI-${Date.now()}`;
    const batch = await StockIn.create({
      batchNo, product: req.body.product,
      quantity: +quantity, supplier,
      costTotal: +costTotal || 0,
      notes, status: status || 'received',
      shop: shopId,
    });

    // Update product stock
    if (status !== 'cancelled') {
      await Product.findOneAndUpdate(
        { _id: req.body.product, shop: shopId },
        { $inc: { currentStock: +quantity } }
      );
    }

    const populated = await StockIn.findById(batch._id).populate('product','name sku unit barcode');
    respond(res, 201, populated, 'স্টক গ্রহণ সম্পন্ন।');
  } catch (e) { next(e); }
};

// ── Sales / Stock Out ─────────────────────────────────────────────────────────
exports.shopGetSales = async (req, res, next) => {
  try {
    const { page=1, limit=10 } = req.query;
    const skip = (Math.max(1,+page)-1)*10;
    const [items, total] = await Promise.all([
      StockOut.find({ shop: req.shop._id }).sort({ createdAt:-1 }).skip(skip).limit(10),
      StockOut.countDocuments({ shop: req.shop._id }),
    ]);
    res.json({ success:true, data:items, meta:{ page:+page, total, pages: Math.ceil(total/10) } });
  } catch (e) { next(e); }
};

exports.shopCreateSale = async (req, res, next) => {
  try {
    const { items, customer, paymentType, paymentStatus, totalAmount, discount, notes } = req.body;
    const shopId  = req.shop._id;
    const orderId = `#SO-${Date.now()}`;

    const sale = await StockOut.create({
      orderId, items, customer: customer || 'Walk-in',
      paymentType, paymentStatus,
      totalAmount: +totalAmount, discount: +discount || 0,
      notes, shop: shopId,
    });

    // Deduct stock for each item
    for (const item of items) {
      await Product.findOneAndUpdate(
        { _id: item.product, shop: shopId },
        { $inc: { currentStock: -item.quantity } }
      );
    }

    // If credit/baki — add to ledger
    if (paymentType === 'credit') {
      await CreditLedger.create({
        customer: customer || 'Walk-in',
        transactionType: 'credit',
        amount: +totalAmount,
        balance: +totalAmount,
        reference: orderId,
        shop: shopId,
      });
    }

    respond(res, 201, { ...sale.toJSON(), orderId }, 'বিক্রয় সম্পন্ন।');
  } catch (e) { next(e); }
};

// ── Credit Ledger ─────────────────────────────────────────────────────────────
exports.shopGetLedger = async (req, res, next) => {
  try {
    const { page=1, limit=15, type, customer } = req.query;
    const filter = { shop: req.shop._id };
    if (type)     filter.transactionType = type;
    if (customer) filter.customer = new RegExp(customer, 'i');
    const skip = (Math.max(1,+page)-1)*15;
    const [items, total] = await Promise.all([
      CreditLedger.find(filter).sort({ createdAt:-1 }).skip(skip).limit(15),
      CreditLedger.countDocuments(filter),
    ]);
    res.json({ success:true, data:items, meta:{ page:+page, total, pages: Math.ceil(total/15) } });
  } catch (e) { next(e); }
};

exports.shopCreateLedgerEntry = async (req, res, next) => {
  try {
    const { customer, transactionType, amount, reference, notes } = req.body;
    const shopId = req.shop._id;

    const prevEntries = await CreditLedger.find({ shop: shopId, customer }).sort({ createdAt:-1 }).limit(1);
    const prevBalance = prevEntries[0]?.balance || 0;
    const newBalance  = transactionType === 'credit'
      ? prevBalance + +amount
      : prevBalance - +amount;

    const entry = await CreditLedger.create({
      customer, transactionType, amount: +amount,
      balance: newBalance, reference, notes, shop: shopId,
    });
    respond(res, 201, entry, 'এন্ট্রি সংরক্ষিত হয়েছে।');
  } catch (e) { next(e); }
};

exports.shopDeleteLedgerEntry = async (req, res, next) => {
  try {
    await CreditLedger.findOneAndDelete({ _id: req.params.id, shop: req.shop._id });
    respond(res, 200, null, 'এন্ট্রি মুছে গেছে।');
  } catch (e) { next(e); }
};

exports.shopGetCustomers = async (req, res, next) => {
  try {
    const customers = await CreditLedger.distinct('customer', { shop: req.shop._id });
    respond(res, 200, customers);
  } catch (e) { next(e); }
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
exports.shopGetSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ shop: req.shop._id, isActive: true }).sort({ name:1 });
    respond(res, 200, suppliers);
  } catch (e) { next(e); }
};

exports.shopCreateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, shop: req.shop._id });
    respond(res, 201, supplier, 'সরবরাহকারী যোগ হয়েছে।');
  } catch (e) { next(e); }
};

// ── Inventory ─────────────────────────────────────────────────────────────────
exports.shopGetInventory = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = { shop: req.shop._id, isActive: true };
    if (search)   filter.$or = [{ name: new RegExp(search,'i') }, { barcode: new RegExp(search,'i') }];
    if (category) filter.category = new RegExp(category,'i');
    const products = await Product.find(filter).sort({ name:1 });
    respond(res, 200, products);
  } catch (e) { next(e); }
};

// ── Notifications ─────────────────────────────────────────────────────────────
exports.shopGetNotifications = async (req, res, next) => {
  try {
    const notifs = await Notification.find({ shop: req.shop._id }).sort({ createdAt:-1 }).limit(30);
    respond(res, 200, notifs);
  } catch (e) { next(e); }
};


// ═══════════════════════════════════════════════════════════════
// ADMIN — Central Product Database (Option A)
// Only name, company, category, barcode, MRP, unit. NO cost price.
// ═══════════════════════════════════════════════════════════════
exports.adminListCentral = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 30 } = req.query;
    const filter = { isCentral: true };
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
      { company: new RegExp(search, 'i') },
      { category: new RegExp(search, 'i') },
    ];
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const lim  = Math.min(100, +limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, meta: { page: +page, total, pages: Math.ceil(total / lim) } });
  } catch (e) { next(e); }
};

exports.adminCreateCentralProduct = async (req, res, next) => {
  try {
    const { name, company, category, barcode, unit, mrp } = req.body;
    if (!name || !barcode) return res.status(400).json({ success: false, message: 'নাম ও বারকোড প্রয়োজন।' });
    const dup = await Product.findOne({ isCentral: true, barcode });
    if (dup) return res.status(409).json({ success: false, message: 'এই বারকোড আগেই আছে।' });
    const product = await Product.create({
      sku: `C-${Date.now()}`, name, company: company || '', category: category || 'সাধারণ',
      barcode, unit: unit || 'pcs', mrp: +mrp || 0, salePrice: +mrp || 0,
      costPrice: 0, currentStock: 0, isCentral: true, shop: null,
    });
    res.status(201).json({ success: true, message: 'কেন্দ্রীয় পণ্য যোগ হয়েছে।', data: product });
  } catch (e) { next(e); }
};

exports.adminUpdateCentralProduct = async (req, res, next) => {
  try {
    const allowed = ['name', 'company', 'category', 'unit', 'mrp', 'isActive'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (updates.mrp !== undefined) updates.salePrice = +updates.mrp;
    const product = await Product.findOneAndUpdate({ _id: req.params.id, isCentral: true }, updates, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'পণ্য পাওয়া যায়নি।' });
    res.json({ success: true, message: 'আপডেট হয়েছে।', data: product });
  } catch (e) { next(e); }
};

exports.adminDeleteCentralProduct = async (req, res, next) => {
  try {
    await Product.findOneAndDelete({ _id: req.params.id, isCentral: true });
    res.json({ success: true, message: 'পণ্য মুছে গেছে।' });
  } catch (e) { next(e); }
};

exports.adminListShops = async (req, res, next) => {
  try {
    const { Shop } = require('../models');
    const shops = await Shop.find().sort({ createdAt: -1 });
    res.json({ success: true, data: shops });
  } catch (e) { next(e); }
};

exports.adminCategories = async (req, res, next) => {
  try {
    const cats = await Product.distinct('category', { isCentral: true });
    const companies = await Product.distinct('company', { isCentral: true });
    res.json({ success: true, data: { categories: cats.filter(Boolean), companies: companies.filter(Boolean) } });
  } catch (e) { next(e); }
};
