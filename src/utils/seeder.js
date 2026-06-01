require('dotenv').config();
const mongoose = require('mongoose');
const { User, Product, Supplier, Shop } = require('../models');

const SUPPLIERS = [
  { name: 'মিষ্টি ট্রেডিং',     email: 'info@misti.com',      phone: '01711-000001' },
  { name: 'ঢাকা ক্যান্ডি হাউস', email: 'orders@dch.com',      phone: '01711-000002' },
  { name: 'চকোলেট বেস',          email: 'sales@chocobase.com', phone: '01711-000003' },
  { name: 'জেলি ওয়ার্কস',       email: 'hello@jelly.com',     phone: '01711-000004' },
];

// CENTRAL products (isCentral: true, shop: null) — Option A.
// Cost price = 0 (never used). MRP exposed to shops. Shops set own cost & sale.
const CENTRAL_PRODUCTS = [
  { name: 'রেড চিউ টফি',         company: 'প্রাণ আরএফএল',  category: 'টফি',          unit: 'pcs',   mrp: 5,   barcode: '8901030849695' },
  { name: 'ললিপপ মিক্স',          company: 'প্রাণ আরএফএল',  category: 'ললিপপ',        unit: 'pcs',   mrp: 7,   barcode: '8901030849701' },
  { name: 'চকোলেট ফাজ',           company: 'চকোলেট বেস',     category: 'চকোলেট',       unit: 'boxes', mrp: 600, barcode: '8901030849718' },
  { name: 'গামি বিয়ার ২০০গ্রাম',  company: 'জেলি ওয়ার্কস',   category: 'গামি',         unit: 'packs', mrp: 110, barcode: '8901030849725' },
  { name: 'মার্শমেলো টুইস্ট',     company: 'ফ্লাফি কো',       category: 'মার্শমেলো',    unit: 'bags',  mrp: 170, barcode: '8901030849732' },
  { name: 'সাওয়ার ওয়ার্ম প্যাক', company: 'জেলি ওয়ার্কস',   category: 'সাওয়ার ক্যান্ডি', unit: 'packs', mrp: 130, barcode: '8901030849749' },
  { name: 'কোলা বোতল ২৫০গ্রাম',   company: 'জেলি ওয়ার্কস',   category: 'গামি',         unit: 'packs', mrp: 120, barcode: '8901030849756' },
  { name: 'পেপারমিন্ট ক্যান্ডি',  company: 'আকিজ ফুড',        category: 'হার্ড ক্যান্ডি', unit: 'pcs',  mrp: 3,   barcode: '8901030849763' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB তে সংযুক্ত হয়েছে');

  await Promise.all([User.deleteMany(), Product.deleteMany(), Supplier.deleteMany(), Shop.deleteMany()]);

  // Admin users
  await User.create({ name: 'Wahidsadik Aditto', email: 'admin@minibazar.com',   password: 'password123', role: 'admin'   });
  await User.create({ name: 'Manager',           email: 'manager@minibazar.com', password: 'password123', role: 'manager' });
  await User.create({ name: 'Staff',             email: 'staff@minibazar.com',   password: 'password123', role: 'staff'   });

  // Central product database (admin-managed, shared lookup)
  await Product.insertMany(CENTRAL_PRODUCTS.map(p => ({
    ...p, sku: `C-${p.barcode}`, costPrice: 0, salePrice: p.mrp,
    currentStock: 0, reorderLevel: 0, isCentral: true, shop: null,
  })));

  // Demo shop (tenant) — its own isolated account
  const demoShop = await Shop.create({
    name: 'রহিম স্টোর', ownerName: 'রহিম উদ্দিন',
    email: 'rahim@shop.com', password: 'password123',
    phone: '01710-000000', address: 'ঢাকা', businessType: 'মিষ্টান্ন',
  });

  // Demo shop's own suppliers + own products (isolated)
  await Supplier.insertMany(SUPPLIERS.map(s => ({ ...s, shop: demoShop._id })));

  console.log('✅ MiniBazar ERP ডেটাবেজ সম্পন্ন!');
  console.log('───────────────────────────────');
  console.log('Admin (Central DB): admin@minibazar.com / password123');
  console.log('Demo Shop owner:    rahim@shop.com / password123');
  console.log(`Central products:   ${CENTRAL_PRODUCTS.length} টি`);
  process.exit(0);
}
seed().catch(err => { console.error(err); process.exit(1); });
