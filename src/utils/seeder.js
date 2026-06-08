import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';
import User     from '../models/User.model.js';
import Shop     from '../models/Shop.model.js';
import Product  from '../models/Product.model.js';
import Supplier from '../models/Supplier.model.js';

const CENTRAL_PRODUCTS = [
  { name:'রেড চিউ টফি',        company:'প্রাণ আরএফএল', category:'টফি',          unit:'pcs',   mrp:5,   barcode:'8901030849695' },
  { name:'ললিপপ মিক্স',         company:'প্রাণ আরএফএল', category:'ললিপপ',        unit:'pcs',   mrp:7,   barcode:'8901030849701' },
  { name:'চকোলেট ফাজ',          company:'চকোলেট বেস',   category:'চকোলেট',       unit:'boxes', mrp:600, barcode:'8901030849718' },
  { name:'গামি বিয়ার ২০০গ্রাম', company:'জেলি ওয়ার্কস', category:'গামি',         unit:'packs', mrp:110, barcode:'8901030849725' },
  { name:'মার্শমেলো টুইস্ট',    company:'ফ্লাফি কো',    category:'মার্শমেলো',    unit:'bags',  mrp:170, barcode:'8901030849732' },
  { name:'সাওয়ার ওয়ার্ম প্যাক',company:'জেলি ওয়ার্কস', category:'সাওয়ার ক্যান্ডি', unit:'packs', mrp:130, barcode:'8901030849749' },
  { name:'পেপারমিন্ট ক্যান্ডি', company:'আকিজ ফুড',    category:'হার্ড ক্যান্ডি', unit:'pcs',  mrp:3,   barcode:'8901030849763' },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Clear
    await Promise.all([
      User.deleteMany(),
      Product.deleteMany(),
      Supplier.deleteMany(),
      Shop.deleteMany(),
    ]);
    console.log('🗑️  Cleared existing data');

    // Admin user
    await User.create({
      name: 'Wahidsadik Aditto',
      email: 'admin@minibazar.com',
      password: 'password123',
      role: 'admin',
    });
    console.log('👤 Admin user created: admin@minibazar.com / password123');

    // Central products
    await Product.insertMany(CENTRAL_PRODUCTS.map(p => ({
      ...p, sku: `C-${p.barcode}`,
      costPrice: 0, salePrice: p.mrp,
      currentStock: 0, reorderLevel: 0,
      isCentral: true, shop: null,
    })));
    console.log(`📦 ${CENTRAL_PRODUCTS.length} central products created`);

    // Demo shop
    const shop = await Shop.create({
      name: 'রহিম স্টোর', ownerName: 'রহিম উদ্দিন',
      email: 'rahim@shop.com', password: 'password123',
      phone: '01710-000000', address: 'ঢাকা', businessType: 'মিষ্টান্ন',
      isEmailVerified: true, // verified for demo
    });
    console.log(`🏪 Demo shop created: rahim@shop.com / password123`);

    // Demo suppliers
    await Supplier.insertMany([
      { shop: shop._id, name: 'মিষ্টি ট্রেডিং', phone: '01711-000001' },
      { shop: shop._id, name: 'ঢাকা ক্যান্ডি হাউস', phone: '01711-000002' },
    ]);

    console.log('\n✅ Seed complete!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:     admin@minibazar.com / password123');
    console.log('Demo Shop: rahim@shop.com / password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  }
};

seed();
