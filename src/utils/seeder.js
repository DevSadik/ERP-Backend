import 'dotenv/config';
import mongoose       from 'mongoose';
import CentralProduct from '../models/CentralProduct.model.js';

// ── Central catalog only (NO users, NO passwords, NO demo accounts) ───────────
// This seeder only loads the master product catalog.
// Admin accounts must be created securely via the /setup-admin API (see docs).
const CENTRAL_PRODUCTS = [
  { name:'Red Chew Toffee',   company:'PRAN RFL',       category:'Toffee',     unit:'pcs',   mrp:5,   barcode:'8901030849695' },
  { name:'Lollipop Mix',      company:'PRAN RFL',       category:'Lollipop',   unit:'pcs',   mrp:7,   barcode:'8901030849701' },
  { name:'Chocolate Fudge',   company:'Chocolate Base', category:'Chocolate',  unit:'boxes', mrp:600, barcode:'8901030849718' },
  { name:'Gummy Bear 200g',   company:'Jelly Works',    category:'Gummy',      unit:'packs', mrp:110, barcode:'8901030849725' },
  { name:'Marshmallow Twist', company:'Fluffy Co',      category:'Marshmallow',unit:'bags',  mrp:170, barcode:'8901030849732' },
  { name:'Sour Worm Pack',    company:'Jelly Works',    category:'Sour Candy', unit:'packs', mrp:130, barcode:'8901030849749' },
  { name:'Peppermint Candy',  company:'Akij Food',      category:'Hard Candy', unit:'pcs',   mrp:3,   barcode:'8901030849763' },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'ERP',
    });
    console.log('✅ MongoDB connected (db: ' + (process.env.DB_NAME || 'ERP') + ')');

    // Only clear and reseed central catalog. Users/shops are NOT touched.
    await CentralProduct.deleteMany();
    await CentralProduct.insertMany(CENTRAL_PRODUCTS);
    console.log('📦 ' + CENTRAL_PRODUCTS.length + ' central products seeded');

    console.log('\n✅ Seed complete (central catalog only).');
    console.log('ℹ️  No admin/demo accounts created — create admin securely via /setup-admin API.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  }
};

seed();
