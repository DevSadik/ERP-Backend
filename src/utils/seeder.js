import 'dotenv/config';
import mongoose       from 'mongoose';
import CentralProduct from '../models/CentralProduct.model.js';

// ── Seeder (intentionally empty) ──────────────────────────────────────────────
// No default/demo products. The admin builds the central catalog themselves
// from the admin panel. Categories & companies are suggested from whatever the
// admin has actually added — no hardcoded defaults.
const CENTRAL_PRODUCTS = [];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'ERP',
    });
    console.log('✅ MongoDB connected (db: ' + (process.env.DB_NAME || 'ERP') + ')');

    if (CENTRAL_PRODUCTS.length === 0) {
      console.log('ℹ️  No demo products to seed. Catalog is managed from the admin panel.');
      process.exit(0);
    }

    await CentralProduct.insertMany(CENTRAL_PRODUCTS);
    console.log('📦 ' + CENTRAL_PRODUCTS.length + ' central products seeded');

    console.log('\n✅ Seed complete.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
    process.exit(1);
  }
};

seed();
