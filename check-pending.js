// Diagnostic: check pending products directly in the database.
// Run on your server:  node check-pending.js
import 'dotenv/config';
import mongoose from 'mongoose';
import PendingProduct from './src/models/PendingProduct.model.js';
import CentralProduct from './src/models/CentralProduct.model.js';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || 'ERP',
    });
    console.log('✅ Connected to DB:', process.env.DB_NAME || 'ERP');
    console.log('');

    const allPending = await PendingProduct.find({});
    console.log(`📋 Total pending products in DB: ${allPending.length}`);

    const byStatus = {
      pending:  allPending.filter(p => p.status === 'pending').length,
      approved: allPending.filter(p => p.status === 'approved').length,
      rejected: allPending.filter(p => p.status === 'rejected').length,
    };
    console.log('   Pending:', byStatus.pending);
    console.log('   Approved:', byStatus.approved);
    console.log('   Rejected:', byStatus.rejected);
    console.log('');

    if (allPending.length > 0) {
      console.log('── All pending products ──');
      allPending.forEach(p => {
        console.log(`   [${p.status}] ${p.name} — barcode: ${p.barcode} — shop: ${p.shopName}`);
      });
    } else {
      console.log('⚠️  No pending products found at all.');
      console.log('   This means the shop-side submission is NOT saving to the DB.');
      console.log('   → Check that shopkeepers add products with a NEW barcode');
      console.log('     (a barcode NOT already in the central catalog).');
    }
    console.log('');

    const centralCount = await CentralProduct.countDocuments();
    console.log(`📦 Central products: ${centralCount}`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
};

run();
