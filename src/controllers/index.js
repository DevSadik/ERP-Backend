const jwt  = require('jsonwebtoken');
const { User, Product, Supplier, StockIn, StockOut, CreditLedger, Notification } = require('../models');

// ── Helpers ───────────────────────────────────────────────────────────────────
const signToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const respond = (res, status, data, message = 'OK', meta = {}) =>
  res.status(status).json({ success: true, message, data, meta });

const paginate = (page = 1, limit = 20) => ({
  skip: (Math.max(1, +page) - 1) * Math.min(100, +limit),
  limit: Math.min(100, +limit),
});

// ── Auth ──────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered.' });
    const user = await User.create({ name, email, password, role });
    const token = signToken(user._id);
    user.password = undefined;
    respond(res, 201, { token, user }, 'User registered.');
  } catch (e) { next(e); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    const token = signToken(user._id);
    user.password = undefined;
    respond(res, 200, { token, user }, 'Login successful.');
  } catch (e) { next(e); }
};

exports.getMe = async (req, res) => respond(res, 200, req.user);

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    respond(res, 200, null, 'Password changed successfully.');
  } catch (e) { next(e); }
};

// ── Products ──────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const filter = { isActive: true };
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { sku:  new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
    ];
    if (category) filter.category = category;
    if (status === 'low') filter.$expr = { $lt: ['$currentStock', '$reorderLevel'] };
    if (status === 'out') filter.currentStock = 0;

    const { skip, limit: lim } = paginate(page, limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(lim),
      Product.countDocuments(filter),
    ]);
    respond(res, 200, products, 'OK', { page: +page, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (e) { next(e); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, image: req.file?.filename });
    respond(res, 201, product, 'Product created.');
  } catch (e) { next(e); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.filename;
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    respond(res, 200, product, 'Product updated.');
  } catch (e) { next(e); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    respond(res, 200, null, 'Product deactivated.');
  } catch (e) { next(e); }
};

exports.getCategories = async (req, res, next) => {
  try {
    const cats = await Product.distinct('category', { isActive: true });
    respond(res, 200, cats);
  } catch (e) { next(e); }
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
exports.getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    respond(res, 200, suppliers);
  } catch (e) { next(e); }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    respond(res, 201, supplier, 'Supplier created.');
  } catch (e) { next(e); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    respond(res, 200, supplier, 'Supplier updated.');
  } catch (e) { next(e); }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });
    respond(res, 200, null, 'Supplier deactivated.');
  } catch (e) { next(e); }
};

// ── Stock-In ──────────────────────────────────────────────────────────────────
exports.getStockIn = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }
    const { skip, limit: lim } = paginate(page, limit);
    const [items, total] = await Promise.all([
      StockIn.find(filter).populate('product', 'name sku unit barcode').populate('receivedBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(lim),
      StockIn.countDocuments(filter),
    ]);
    respond(res, 200, items, 'OK', { page: +page, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (e) { next(e); }
};

exports.createStockIn = async (req, res, next) => {
  try {
    const batch = await StockIn.create({ ...req.body, receivedBy: req.user._id, purchaseDate: req.body.purchaseDate || new Date() });
    await Product.findByIdAndUpdate(req.body.product, { $inc: { currentStock: req.body.quantity } });
    req.app.get('io').emit('stock:updated', { productId: req.body.product });
    await batch.populate('product', 'name sku');
    respond(res, 201, batch, 'Stock batch received.');
  } catch (e) { next(e); }
};

exports.updateStockIn = async (req, res, next) => {
  try {
    const old = await StockIn.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: 'Batch not found.' });
    const diff = (req.body.quantity || old.quantity) - old.quantity;
    const batch = await StockIn.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('product', 'name sku');
    if (diff !== 0) await Product.findByIdAndUpdate(old.product, { $inc: { currentStock: diff } });
    respond(res, 200, batch, 'Batch updated.');
  } catch (e) { next(e); }
};

// ── Stock-Out ─────────────────────────────────────────────────────────────────
exports.getStockOut = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customer, startDate, endDate } = req.query;
    const filter = {};
    if (customer) filter.customer = new RegExp(customer, 'i');
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }
    const { skip, limit: lim } = paginate(page, limit);
    const [items, total] = await Promise.all([
      StockOut.find(filter).populate('items.product', 'name sku').sort({ createdAt: -1 }).skip(skip).limit(lim),
      StockOut.countDocuments(filter),
    ]);
    respond(res, 200, items, 'OK', { page: +page, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (e) { next(e); }
};

exports.createStockOut = async (req, res, next) => {
  try {
    const { items, customer, paymentType, paymentStatus, notes, discount = 0 } = req.body;

    // Validate stock availability
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: `Product not found.` });
      if (product.currentStock < item.quantity)
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.name}". Available: ${product.currentStock}` });
    }

    const totalAmount = items.reduce((s, i) => s + i.subtotal, 0) - discount;
    const order = await StockOut.create({
      items, customer, paymentType, paymentStatus,
      totalAmount, discount, notes, processedBy: req.user._id,
    });

    // Deduct stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { currentStock: -item.quantity } });
    }

    // Auto-create credit ledger entry
    if (paymentType === 'credit') {
      const last = await CreditLedger.findOne({ customer }).sort({ createdAt: -1 });
      const prevBalance = last ? last.balance : 0;
      await CreditLedger.create({
        customer, transactionType: 'credit', amount: totalAmount,
        balance: prevBalance + totalAmount, reference: order.orderId, createdBy: req.user._id,
      });
    }

    // Low stock notifications
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (product && product.currentStock < product.reorderLevel) {
        await Notification.create({
          type: 'warning',
          message: `Low stock: "${product.name}" has ${product.currentStock} ${product.unit} left (reorder at ${product.reorderLevel})`,
        });
        req.app.get('io').emit('notification:low-stock', {
          productId: product._id, name: product.name, stock: product.currentStock,
        });
      }
    }

    await order.populate('items.product', 'name sku');
    respond(res, 201, order, 'Order processed.');
  } catch (e) { next(e); }
};

// ── Credit Ledger ─────────────────────────────────────────────────────────────
exports.getLedger = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customer, type, startDate, endDate } = req.query;
    const filter = {};
    if (customer) filter.customer = new RegExp(customer, 'i');
    if (type)     filter.transactionType = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) { const d = new Date(endDate); d.setHours(23,59,59,999); filter.createdAt.$lte = d; }
    }
    const { skip, limit: lim } = paginate(page, limit);
    const [items, total] = await Promise.all([
      CreditLedger.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      CreditLedger.countDocuments(filter),
    ]);
    respond(res, 200, items, 'OK', { page: +page, limit: lim, total, pages: Math.ceil(total / lim) });
  } catch (e) { next(e); }
};

exports.createLedgerEntry = async (req, res, next) => {
  try {
    const { customer, transactionType, amount, reference, notes } = req.body;
    const last = await CreditLedger.findOne({ customer }).sort({ createdAt: -1 });
    const prevBalance = last ? last.balance : 0;
    const balance = transactionType === 'credit' ? prevBalance + amount : Math.max(0, prevBalance - amount);
    const entry = await CreditLedger.create({ customer, transactionType, amount, balance, reference, notes, createdBy: req.user._id });
    respond(res, 201, entry, 'Ledger entry created.');
  } catch (e) { next(e); }
};

exports.getCustomerBalance = async (req, res, next) => {
  try {
    const customer = req.params.customer;
    const last = await CreditLedger.findOne({ customer }).sort({ createdAt: -1 });
    respond(res, 200, { customer, balance: last ? last.balance : 0 });
  } catch (e) { next(e); }
};

exports.getCustomerList = async (req, res, next) => {
  try {
    const customers = await CreditLedger.distinct('customer');
    respond(res, 200, customers);
  } catch (e) { next(e); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [todaySales, totalProducts, lowStockCount, outOfStockCount, recentOrders, valuation] = await Promise.all([
      StockOut.aggregate([
        { $match: { createdAt: { $gte: today }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $and: [{ $gt: ['$currentStock', 0] }, { $lt: ['$currentStock', '$reorderLevel'] }] } }),
      Product.countDocuments({ isActive: true, currentStock: 0 }),
      StockOut.find().sort({ createdAt: -1 }).limit(10).populate('items.product', 'name'),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock', '$costPrice'] } } } },
      ]),
    ]);
    respond(res, 200, {
      todaySales: todaySales[0]?.total || 0,
      todayOrderCount: todaySales[0]?.count || 0,
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalValuation: valuation[0]?.total || 0,
      recentOrders,
    });
  } catch (e) { next(e); }
};

exports.getHourlySales = async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const data = await StockOut.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: { $hour: '$createdAt' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);
    respond(res, 200, data);
  } catch (e) { next(e); }
};

exports.getWeeklySales = async (req, res, next) => {
  try {
    const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() - 6); sevenDays.setHours(0,0,0,0);
    const data = await StockOut.aggregate([
      { $match: { createdAt: { $gte: sevenDays } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);
    respond(res, 200, data);
  } catch (e) { next(e); }
};

// ── Notifications ─────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res, next) => {
  try {
    const notifs = await Notification.find({ $or: [{ user: req.user._id }, { user: null }] })
      .sort({ createdAt: -1 }).limit(30);
    respond(res, 200, notifs);
  } catch (e) { next(e); }
};

exports.markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ $or: [{ user: req.user._id }, { user: null }] }, { read: true });
    respond(res, 200, null, 'All notifications marked as read.');
  } catch (e) { next(e); }
};

// ── Users (admin only) ────────────────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    respond(res, 200, users);
  } catch (e) { next(e); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, branch } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Email already registered.' });
    const user = await User.create({ name, email, password: password || 'password123', role, branch });
    user.password = undefined;
    respond(res, 201, user, 'User created.');
  } catch (e) { next(e); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'isActive', 'branch'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    respond(res, 200, user, 'User updated.');
  } catch (e) { next(e); }
};

// ── Barcode Lookup (local inventory first, then global registry) ──────────────
exports.lookupBarcode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const clean = code.trim();
    // 1. Check local product catalogue
    let product = await Product.findOne({
      isActive: true,
      $or: [{ barcode: clean }, { sku: clean.toUpperCase() }],
    });
    if (product) return respond(res, 200, { ...product.toJSON(), source: 'local' }, 'পণ্য পাওয়া গেছে।');

    // 2. Check global registry
    const { RegistryProduct } = require('../models');
    const regProduct = await RegistryProduct.findOne({ barcode: clean, status: 'active', isActive: true })
      .populate('brand', 'companyName');
    if (regProduct) {
      return respond(res, 200, {
        _id: null,
        barcode: regProduct.barcode,
        name:    regProduct.name,
        nameBn:  regProduct.nameBn,
        sku:     '',
        unit:    regProduct.unit,
        costPrice: regProduct.tradePrice,
        salePrice: regProduct.mrp,
        category:  regProduct.category,
        images:    regProduct.images,
        brandName: regProduct.brand?.companyName,
        pcsPerCarton: regProduct.pcsPerCarton,
        source: 'registry',
      }, 'গ্লোবাল রেজিস্ট্রি থেকে পণ্য পাওয়া গেছে।');
    }

    return res.status(404).json({ success: false, message: `বারকোড "${clean}" এর কোনো পণ্য পাওয়া যায়নি।` });
  } catch (e) { next(e); }
};
