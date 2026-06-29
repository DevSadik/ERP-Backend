import mongoose from 'mongoose';

// ── Pending Central Product (crowd-sourced catalog, awaiting admin review) ─────
// When a shopkeeper adds a product with a NEW barcode (not already in the
// central catalog), a pending entry is created here. The admin reviews it and
// either approves it (moves to CentralProduct, all shops can use it) or rejects
// it (the product still stays in that shop's own stock — only the central
// listing is declined). Catalog info only — never cost/stock (privacy).
const pendingCentralProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  barcode:     { type: String, required: true, trim: true, unique: true },
  company:     { type: String, trim: true, default: '' },
  category:    { type: String, trim: true, default: 'General' },
  unit:        { type: String, enum: ['pcs','packs','boxes','bags','kg','g','litres'], default: 'pcs' },
  mrp:         { type: Number, default: 0 },

  // Who submitted it (for admin reference)
  submittedByShop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  shopName:        { type: String, trim: true, default: '' },

  status: { type: String, enum: ['pending','rejected'], default: 'pending' },
}, {
  timestamps: true,
  collection: 'pendingcentralproducts',
});

pendingCentralProductSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PendingCentralProduct', pendingCentralProductSchema);
