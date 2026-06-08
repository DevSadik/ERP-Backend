import Customer       from '../models/Customer.model.js';
import CustomerLedger from '../models/CustomerLedger.model.js';
import Product        from '../models/Product.model.js';

const ok  = (res, data, msg = 'OK') => res.json({ success: true, message: msg, data });
const err = (res, status, msg)      => res.status(status).json({ success: false, message: msg });

const getBalance = async (shopId, customerId) => {
  const last = await CustomerLedger
    .findOne({ shop: shopId, customer: customerId })
    .sort({ entryDate: -1, createdAt: -1 }).select('balance');
  return last?.balance ?? 0;
};

// GET /customers
export const listCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const filter = { shop: req.shopId, isActive: true };
    if (search) filter.$or = [
      { name:  new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ name: 1 }).skip(skip).limit(+limit),
      Customer.countDocuments(filter),
    ]);
    const withBalance = await Promise.all(
      customers.map(async c => ({ ...c.toJSON(), currentBalance: await getBalance(req.shopId, c._id) }))
    );
    res.json({ success: true, data: withBalance, meta: { page: +page, total, pages: Math.ceil(total / +limit) } });
  } catch (e) { next(e); }
};

// POST /customers
export const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, address, previousBalance, notes } = req.body;
    if (!name?.trim()) return err(res, 400, 'গ্রাহকের নাম দিন।');
    if (phone) {
      const dup = await Customer.findOne({ shop: req.shopId, phone: phone.trim(), isActive: true });
      if (dup) return err(res, 409, 'এই ফোন নম্বরে আগেই গ্রাহক আছে।');
    }
    const customer = await Customer.create({
      shop: req.shopId, name: name.trim(),
      phone: phone?.trim(), address: address?.trim(),
      previousBalance: +previousBalance || 0, notes,
    });
    if (customer.previousBalance > 0) {
      await CustomerLedger.create({
        shop: req.shopId, customer: customer._id,
        type: 'opening', totalAmount: customer.previousBalance,
        paidAmount: 0, dueAmount: customer.previousBalance,
        balance: customer.previousBalance,
        productName: 'আগের বাকি', entryDate: new Date(),
      });
    }
    ok(res, customer, 'গ্রাহক যোগ হয়েছে।');
  } catch (e) { next(e); }
};

// GET /customers/:id
export const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, shop: req.shopId });
    if (!customer) return err(res, 404, 'গ্রাহক পাওয়া যায়নি।');
    const balance = await getBalance(req.shopId, customer._id);
    ok(res, { ...customer.toJSON(), currentBalance: balance });
  } catch (e) { next(e); }
};

// PUT /customers/:id
export const updateCustomer = async (req, res, next) => {
  try {
    const allowed  = ['name','phone','address','notes'];
    const updates  = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const customer = await Customer.findOneAndUpdate({ _id: req.params.id, shop: req.shopId }, updates, { new: true });
    if (!customer) return err(res, 404, 'গ্রাহক পাওয়া যায়নি।');
    ok(res, customer, 'আপডেট হয়েছে।');
  } catch (e) { next(e); }
};

// DELETE /customers/:id
export const deleteCustomer = async (req, res, next) => {
  try {
    await Customer.findOneAndUpdate({ _id: req.params.id, shop: req.shopId }, { isActive: false });
    ok(res, null, 'গ্রাহক মুছে গেছে।');
  } catch (e) { next(e); }
};

// GET /customers/:id/ledger
export const getCustomerLedger = async (req, res, next) => {
  try {
    const shopId   = req.shopId;
    const custId   = req.params.id;
    const customer = await Customer.findOne({ _id: custId, shop: shopId });
    if (!customer) return err(res, 404, 'গ্রাহক পাওয়া যায়নি।');

    const { page = 1, limit = 100 } = req.query;
    const skip = (Math.max(1, +page) - 1) * +limit;

    const [entries, total, summary] = await Promise.all([
      CustomerLedger.find({ shop: shopId, customer: custId })
        .populate('product','name barcode unit')
        .sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(+limit),
      CustomerLedger.countDocuments({ shop: shopId, customer: custId }),
      CustomerLedger.aggregate([
        { $match: { shop: shopId, customer: customer._id } },
        { $group: {
          _id: null,
          totalSale:    { $sum: { $cond: [{ $eq: ['$type','sale'] }, '$totalAmount', 0] } },
          totalPayment: { $sum: { $cond: [{ $eq: ['$type','payment'] }, '$totalAmount', 0] } },
          totalReturn:  { $sum: { $cond: [{ $eq: ['$type','return'] }, '$totalAmount', 0] } },
        }},
      ]),
    ]);

    const currentBalance = await getBalance(shopId, customer._id);
    ok(res, {
      customer: { ...customer.toJSON(), currentBalance },
      entries,
      summary: summary[0] || { totalSale: 0, totalPayment: 0, totalReturn: 0 },
      meta: { page: +page, total, pages: Math.ceil(total / +limit) },
    });
  } catch (e) { next(e); }
};

// POST /customers/:id/ledger
export const addLedgerEntry = async (req, res, next) => {
  try {
    const { type, barcode, productId, productName, quantity,
            unitPrice, totalAmount, paidAmount, notes, entryDate } = req.body;

    if (!type || !['sale','payment','return'].includes(type))
      return err(res, 400, 'Entry type দিন: sale / payment / return');
    if (!totalAmount || +totalAmount <= 0) return err(res, 400, 'পরিমাণ দিন।');

    const shopId   = req.shopId;
    const customer = await Customer.findOne({ _id: req.params.id, shop: shopId });
    if (!customer) return err(res, 404, 'গ্রাহক পাওয়া যায়নি।');

    let resolvedProduct = productId || null;
    let resolvedName    = productName || '';

    if (barcode && !productId) {
      const prod = await Product.findOne({ shop: shopId, barcode: barcode.trim(), isActive: true });
      if (prod) { resolvedProduct = prod._id; resolvedName = resolvedName || prod.name; }
    }

    const paid    = +paidAmount  || 0;
    const total   = +totalAmount || 0;
    const due     = type === 'payment' ? 0 : Math.max(0, total - paid);
    const prevBal = await getBalance(shopId, customer._id);
    const newBal  = type === 'sale' ? prevBal + due : prevBal - total;

    const entry = await CustomerLedger.create({
      shop: shopId, customer: customer._id, type,
      product: resolvedProduct || undefined,
      productName: resolvedName,
      barcode: barcode?.trim() || '',
      quantity: +quantity || 1,
      unitPrice: +unitPrice || 0,
      totalAmount: total, paidAmount: paid, dueAmount: due,
      balance: newBal, notes,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
    });

    const populated = await CustomerLedger.findById(entry._id).populate('product','name barcode unit');
    ok(res, { entry: populated, newBalance: newBal }, 'এন্ট্রি সংরক্ষিত।');
  } catch (e) { next(e); }
};

// DELETE /customers/:id/ledger/:entryId
export const deleteLedgerEntry = async (req, res, next) => {
  try {
    const entry = await CustomerLedger.findOne({
      _id: req.params.entryId, shop: req.shopId, customer: req.params.id,
    });
    if (!entry) return err(res, 404, 'এন্ট্রি পাওয়া যায়নি।');
    await CustomerLedger.findByIdAndDelete(entry._id);

    // Recalculate balances
    const remaining = await CustomerLedger.find({ shop: req.shopId, customer: req.params.id })
      .sort({ entryDate: 1, createdAt: 1 });
    let bal = 0;
    for (const e of remaining) {
      if (['sale','opening'].includes(e.type)) bal += e.dueAmount;
      else bal -= e.totalAmount;
      await CustomerLedger.findByIdAndUpdate(e._id, { balance: bal });
    }
    ok(res, { newBalance: bal }, 'মুছে গেছে।');
  } catch (e) { next(e); }
};

// GET /customers/public/:token — no auth required
export const publicView = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ publicToken: req.params.token, isActive: true });
    if (!customer) return err(res, 404, 'অ্যাকাউন্ট পাওয়া যায়নি।');

    const entries  = await CustomerLedger.find({ customer: customer._id })
      .populate('product','name barcode').sort({ entryDate: -1, createdAt: -1 }).limit(100);
    const balance  = await getBalance(customer.shop, customer._id);

    ok(res, {
      customer: { name: customer.name, phone: customer.phone, currentBalance: balance },
      entries: entries.map(e => ({
        _id: e._id, type: e.type, productName: e.productName || e.product?.name,
        quantity: e.quantity, unitPrice: e.unitPrice, totalAmount: e.totalAmount,
        paidAmount: e.paidAmount, dueAmount: e.dueAmount, balance: e.balance,
        notes: e.notes, entryDate: e.entryDate,
      })),
    });
  } catch (e) { next(e); }
};
