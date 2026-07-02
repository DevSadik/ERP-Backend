import jwt            from 'jsonwebtoken';
import Product        from '../models/Product.model.js';
import CentralProduct from '../models/CentralProduct.model.js';
import PendingProduct  from '../models/PendingProduct.model.js';
import StockIn        from '../models/StockIn.model.js';
import StockOut       from '../models/StockOut.model.js';
import CreditLedger   from '../models/CreditLedger.model.js';
import Customer       from '../models/Customer.model.js';
import Supplier       from '../models/Supplier.model.js';
import Notification   from '../models/Notification.model.js';

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

// ── Profile ───────────────────────────────────────────────────────────────────
export const getMe = (req, res) => ok(res, req.shop);

export const updateMe = async (req, res, next) => {
  try {
    const allowed = ['name', 'ownerName', 'phone', 'address', 'businessType'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (req.file) updates.logo = req.file.filename;
    Object.assign(req.shop, updates);
    await req.shop.save({ validateBeforeSave: false });
    ok(res, req.shop, 'প্রোফাইল আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const shop = await req.shop.constructor.findById(req.shop._id).select('+password');
    if (!(await shop.comparePassword(currentPassword)))
      return err(res, 401, 'বর্তমান পাসওয়ার্ড ভুল।');
    shop.password = newPassword;
    await shop.save();
    ok(res, null, 'পাসওয়ার্ড পরিবর্তন হয়েছে।');
  } catch (e) { next(e); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res, next) => {
  try {
    const shopId     = req.shopId;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

    const [todaySales, todayOrders, totalProducts, lowStock, inventoryValue, recentOrders] =
      await Promise.all([
        StockOut.aggregate([
          { $match: { shop: shopId, createdAt: { $gte: todayStart, $lte: todayEnd } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        StockOut.countDocuments({ shop: shopId, createdAt: { $gte: todayStart } }),
        Product.countDocuments({ shop: shopId, isActive: true }),
        Product.countDocuments({ shop: shopId, isActive: true, $expr: { $lte: ['$currentStock','$reorderLevel'] } }),
        Product.aggregate([
          { $match: { shop: shopId, isActive: true } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock','$costPrice'] } } } },
        ]),
        StockOut.find({ shop: shopId }).sort({ createdAt: -1 }).limit(10)
          .select('orderId customer totalAmount paymentType createdAt'),
      ]);

    ok(res, {
      todaySales:     todaySales[0]?.total    || 0,
      todayOrders,
      totalProducts,
      lowStockCount:  lowStock,
      inventoryValue: inventoryValue[0]?.total || 0,
      recentOrders,
    });
  } catch (e) { next(e); }
};

export const getWeeklySales = async (req, res, next) => {
  try {
    const shopId = req.shopId;
    const days   = [];
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const end = new Date(d); end.setHours(23,59,59,999);
      const [agg] = await StockOut.aggregate([
        { $match: { shop: shopId, createdAt: { $gte: d, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]);
      days.push({ date: d.toISOString().split('T')[0], total: agg?.total || 0, count: agg?.count || 0 });
    }
    ok(res, days);
  } catch (e) { next(e); }
};

// ── Products ──────────────────────────────────────────────────────────────────
export const getProducts = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const filter = { shop: req.shopId, isActive: true };
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
      { sku: new RegExp(search, 'i') },
    ];
    if (category) filter.category = new RegExp(category, 'i');
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const lim  = Math.min(100, +limit);
    const [data, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(lim),
      Product.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page: +page, limit: lim, total, pages: Math.ceil(total / lim) } });
  } catch (e) { next(e); }
};

export const createProduct = async (req, res, next) => {
  try {
    if (req.body.barcode) {
      const dup = await Product.findOne({ shop: req.shopId, barcode: req.body.barcode });
      if (dup) return err(res, 409, 'এই বারকোড দিয়ে পণ্য আগেই আছে।');
    }
    const product = await Product.create({
      ...req.body,
      sku: req.body.sku || `SKU-${Date.now()}`,
      shop: req.shopId,
      isCentral: false,
    });

    // Crowd-sourced catalog: if this product has a NEW barcode (not already in
    // the central catalog), submit its catalog info for admin review. The
    // product is ALWAYS kept in the shop's own stock regardless. Only catalog
    // info is shared — never cost price or stock.
    const bc = (req.body.barcode || '').trim();
    console.log('🆕 createProduct. Barcode:', JSON.stringify(bc));
    if (bc) {
      try {
        const inCentral = await CentralProduct.findOne({ barcode: bc });
        console.log(inCentral ? '  → in central, skip' : '  → NOT in central, adding pending');
        if (!inCentral) {
          // upsert so the same barcode never creates two pending rows
          await PendingProduct.updateOne(
            { barcode: bc },
            {
              $setOnInsert: {
                barcode:  bc,
                name:     product.name,
                company:  product.company || '',
                category: product.category || 'General',
                unit:     product.unit || 'pcs',
                mrp:      product.salePrice || product.mrp || 0,
                shop:     req.shopId,
                shopName: req.shop?.shopName || '',
                status:   'pending',
              },
            },
            { upsert: true }
          );
        }
      } catch (_) { /* never block product creation on pending-submit failure */ }
    }

    ok(res, product, 'পণ্য তৈরি হয়েছে।');
  } catch (e) { next(e); }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId },
      req.body, { new: true }
    );
    if (!product) return err(res, 404, 'পণ্য পাওয়া যায়নি।');
    ok(res, product, 'পণ্য আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

export const deleteProduct = async (req, res, next) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, shop: req.shopId }, { isActive: false });
    ok(res, null, 'পণ্য নিষ্ক্রিয় করা হয়েছে।');
  } catch (e) { next(e); }
};

// ── Barcode Lookup (own shop first → central catalog) ─────────────────────────
export const lookupBarcode = async (req, res, next) => {
  try {
    const code   = req.params.code.trim();
    const shopId = req.shopId;

    // 1. Own shop's product (local stock) — match barcode or sku
    let product = await Product.findOne({
      shop: shopId,
      isActive: { $ne: false },
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
    });
    if (product) return ok(res, { ...product.toJSON(), source: 'own' });

    // 2. Central catalog (separate collection) — Option A:
    //    only expose name/company/category/mrp. Cost price NEVER shared.
    //    isActive:{$ne:false} so older records without the field still match.
    const central = await CentralProduct.findOne({
      barcode: code,
      isActive: { $ne: false },
    });
    if (central) return ok(res, {
      _id:      null,
      name:     central.name,
      company:  central.company,
      category: central.category,
      barcode:  central.barcode,
      unit:     central.unit,
      mrp:      central.mrp,
      salePrice: central.mrp,
      costPrice: '',          // shopkeeper enters their own cost
      source:   'central',
    });

    return err(res, 404, `বারকোড "${code}" পাওয়া যায়নি।`);
  } catch (e) { next(e); }
};

// ── Inventory ─────────────────────────────────────────────────────────────────
export const getInventory = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const filter = { shop: req.shopId, isActive: true };
    if (search) filter.$or = [
      { name: new RegExp(search, 'i') },
      { barcode: new RegExp(search, 'i') },
    ];
    if (category) filter.category = new RegExp(category, 'i');
    const data = await Product.find(filter).sort({ name: 1 });
    ok(res, data);
  } catch (e) { next(e); }
};

// ── Stock In ──────────────────────────────────────────────────────────────────
export const getStockIn = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status } = req.query;
    const filter = { shop: req.shopId };
    if (status) filter.status = status;
    const skip = (Math.max(1, +page) - 1) * 15;
    const [data, total] = await Promise.all([
      StockIn.find(filter).populate('product','name sku unit barcode').sort({ createdAt: -1 }).skip(skip).limit(15),
      StockIn.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page: +page, total, pages: Math.ceil(total / 15) } });
  } catch (e) { next(e); }
};

export const createStockIn = async (req, res, next) => {
  try {
    const { quantity, supplier, costTotal, notes, status,
            productName, barcode, company, mrp, sku, category, unit, costPrice, salePrice, reorderLevel } = req.body;
    const shopId = req.shopId;
    let { product: productId } = req.body;

    if (!productId && productName) {
      // Check existing by barcode
      let existing = barcode ? await Product.findOne({ shop: shopId, barcode }) : null;
      if (existing) {
        if (costPrice) existing.costPrice = +costPrice;
        if (salePrice) existing.salePrice = +salePrice;
        if (category)  existing.category  = category;
        if (mrp)       existing.mrp       = +mrp;
        await existing.save();
        productId = existing._id;
      } else {
        const newProd = await Product.create({
          shop: shopId, name: productName, barcode, company: company || '',
          mrp: +mrp || 0, category: category || 'সাধারণ', unit: unit || 'pcs',
          costPrice: +costPrice || 0, salePrice: +salePrice || 0,
          reorderLevel: +reorderLevel || 50, currentStock: 0,
          sku: sku || `SKU-${Date.now()}`, isCentral: false,
        });
        productId = newProd._id;

        // Crowd-sourced catalog: if this NEW product has a barcode that is not
        // already in the central catalog, submit its catalog info for admin review.
        const bc = (barcode || '').trim();
        console.log('📦 StockIn new product created. Barcode:', JSON.stringify(bc));
        if (bc) {
          try {
            const inCentral = await CentralProduct.findOne({ barcode: bc });
            console.log(inCentral ? '  → Already in central, skip pending' : '  → NOT in central, adding to pending');
            if (!inCentral) {
              const result = await PendingProduct.updateOne(
                { barcode: bc },
                {
                  $setOnInsert: {
                    barcode:  bc,
                    name:     productName,
                    company:  company || '',
                    category: category || 'General',
                    unit:     unit || 'pcs',
                    mrp:      +mrp || +salePrice || 0,
                    shop:     shopId,
                    shopName: req.shop?.shopName || '',
                    status:   'pending',
                  },
                },
                { upsert: true }
              );
              console.log('  ✅ Pending result:', JSON.stringify(result));
            }
          } catch (e) { console.log('  ❌ Pending error:', e.message); }
        }
      }
    }

    const batchNo = `SI-${Date.now()}`;
    const batch   = await StockIn.create({
      shop: shopId, batchNo, product: productId,
      quantity: +quantity, supplier, costTotal: +costTotal || 0,
      notes, status: status || 'received',
    });

    if (status !== 'cancelled' && productId) {
      await Product.findOneAndUpdate({ _id: productId, shop: shopId }, { $inc: { currentStock: +quantity } });
    }

    const populated = await StockIn.findById(batch._id).populate('product','name sku unit barcode');
    ok(res, populated, 'স্টক গ্রহণ সম্পন্ন।');
  } catch (e) { next(e); }
};

// ── Sales ─────────────────────────────────────────────────────────────────────
export const getSales = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Math.max(1, +page) - 1) * 10;
    const [data, total] = await Promise.all([
      StockOut.find({ shop: req.shopId }).sort({ createdAt: -1 }).skip(skip).limit(10),
      StockOut.countDocuments({ shop: req.shopId }),
    ]);
    res.json({ success: true, data, meta: { page: +page, total, pages: Math.ceil(total / 10) } });
  } catch (e) { next(e); }
};

export const createSale = async (req, res, next) => {
  try {
    const { items, customer, paymentType, paymentStatus, totalAmount, discount, notes } = req.body;
    const shopId  = req.shopId;
    const orderId = `#SO-${Date.now()}`;

    if (!items || !items.length)
      return err(res, 400, 'কমপক্ষে একটি পণ্য যোগ করুন।');

    // Normalize each item — ensure quantity, salePrice and total are present
    const normalizedItems = items.map(it => {
      const quantity  = +it.quantity  || 0;
      const salePrice = +it.salePrice || +it.price || 0;
      const total     = it.total != null ? +it.total : quantity * salePrice;
      return {
        product:   it.product || it._id || null,
        name:      it.name || '',
        quantity,
        salePrice,
        costPrice: +it.costPrice || 0,
        total,
      };
    });

    // Compute total amount if not sent
    const computedTotal = normalizedItems.reduce((s, i) => s + i.total, 0) - (+discount || 0);
    const finalTotal    = totalAmount != null ? +totalAmount : computedTotal;

    const sale = await StockOut.create({
      shop: shopId, orderId, items: normalizedItems,
      customer: customer || 'Walk-in',
      paymentType, paymentStatus,
      totalAmount: finalTotal, discount: +discount || 0, notes,
    });

    // Deduct stock
    for (const item of normalizedItems) {
      if (item.product) {
        await Product.findOneAndUpdate(
          { _id: item.product, shop: shopId },
          { $inc: { currentStock: -item.quantity } }
        );
      }
    }

    // Auto-credit ledger for credit sales
    if (paymentType === 'credit') {
      await CreditLedger.create({
        shop: shopId, customer: customer || 'Walk-in',
        transactionType: 'credit', amount: finalTotal,
        balance: finalTotal, reference: orderId,
      });
    }

    ok(res, sale, 'বিক্রয় সম্পন্ন।');
  } catch (e) { next(e); }
};

// ── Credit Ledger ─────────────────────────────────────────────────────────────
export const getLedger = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, type, customer } = req.query;
    const filter = { shop: req.shopId };
    if (type)     filter.transactionType = type;
    if (customer) filter.customer = new RegExp(customer, 'i');
    const skip = (Math.max(1, +page) - 1) * 15;
    const [data, total] = await Promise.all([
      CreditLedger.find(filter).sort({ createdAt: -1 }).skip(skip).limit(15),
      CreditLedger.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page: +page, total, pages: Math.ceil(total / 15) } });
  } catch (e) { next(e); }
};

export const createLedgerEntry = async (req, res, next) => {
  try {
    const { customer, transactionType, amount, reference, notes } = req.body;
    const shopId = req.shopId;
    const [prev] = await CreditLedger.find({ shop: shopId, customer }).sort({ createdAt: -1 }).limit(1);
    const prevBal  = prev?.balance || 0;
    const newBalance = transactionType === 'credit' ? prevBal + +amount : prevBal - +amount;
    const entry = await CreditLedger.create({
      shop: shopId, customer, transactionType, amount: +amount, balance: newBalance, reference, notes,
    });
    ok(res, entry, 'এন্ট্রি সংরক্ষিত।');
  } catch (e) { next(e); }
};

export const deleteLedgerEntry = async (req, res, next) => {
  try {
    await CreditLedger.findOneAndDelete({ _id: req.params.id, shop: req.shopId });
    ok(res, null, 'মুছে গেছে।');
  } catch (e) { next(e); }
};

export const getLedgerCustomers = async (req, res, next) => {
  try {
    const customers = await CreditLedger.distinct('customer', { shop: req.shopId });
    ok(res, customers);
  } catch (e) { next(e); }
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const getSuppliers = async (req, res, next) => {
  try {
    const data = await Supplier.find({ shop: req.shopId, isActive: true }).sort({ name: 1 });
    ok(res, data);
  } catch (e) { next(e); }
};

export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, shop: req.shopId });
    ok(res, supplier, 'সরবরাহকারী যোগ হয়েছে।');
  } catch (e) { next(e); }
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const data = await Notification.find({ shop: req.shopId }).sort({ createdAt: -1 }).limit(30);
    ok(res, data);
  } catch (e) { next(e); }
};
