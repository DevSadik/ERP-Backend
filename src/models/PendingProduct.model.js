import mongoose from 'mongoose';

// ── Pending Product (crowd-sourced submissions awaiting admin review) ──────────
// When a shopkeeper adds a product with a NEW barcode (not in centralproducts),
// a copy of its catalog info lands here for the admin to Approve or Reject.
// Approve → moves into centralproducts (all shops can use it).
// Reject  → stays rejected; the shop keeps it in their own stock either way.
// Only catalog info is stored here — never cost price or stock (privacy).
const pendingProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  barcode:     { type: String, required: true, trim: true },
  company:     { type: String, trim: true, default: '' },
  category:    { type: String, trim: true, default: 'General' },
  unit:        { type: String, default: 'pcs' },
  mrp:         { type: Number, default: 0 },

  // Who submitted it (for admin reference)
  shop:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  shopName:    { type: String, default: '' },

  status:      { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
}, {
  timestamps: true,
  collection: 'pendingproducts',
});

pendingProductSchema.index({ barcode: 1 }, { unique: true });
pendingProductSchema.index({ status: 1 });

export default mongoose.model('PendingProduct', pendingProductSchema);
