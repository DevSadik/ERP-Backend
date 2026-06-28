import mongoose from 'mongoose';

// ── Central Product (Admin-managed master catalog) ────────────────────────────
// This is a COMPLETELY SEPARATE collection ('centralproducts').
// Admin adds products here. Shopkeepers scan barcode → get name/company/
// category/MRP only. Cost price is NEVER stored here (privacy).
// Each shop keeps its own stock in the separate 'products' collection.
const centralProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  barcode:     { type: String, trim: true },
  company:     { type: String, trim: true },
  category:    { type: String, trim: true, default: 'General' },
  unit:        { type: String, enum: ['pcs','packs','boxes','bags','kg','g','litres'], default: 'pcs' },
  mrp:         { type: Number, default: 0 },   // suggested max retail price
  description: { type: String },
  isActive:    { type: Boolean, default: true },
}, {
  timestamps: true,
  collection: 'centralproducts',   // explicit separate collection name
});

centralProductSchema.index({ barcode: 1 });
centralProductSchema.index({ category: 1 });
centralProductSchema.index({ name: 'text', company: 'text' });

export default mongoose.model('CentralProduct', centralProductSchema);
