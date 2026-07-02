import mongoose from 'mongoose';

// ── Payment record (bKash subscription payments) ──────────────────────────────
const paymentSchema = new mongoose.Schema({
  shop:      { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  paymentID: { type: String, required: true, index: true },  // bKash paymentID
  invoice:   { type: String, required: true },
  planKey:   { type: String, required: true },   // basic, pro, pro3, ...
  amount:    { type: Number, required: true },
  months:    { type: Number, required: true },
  trxId:     { type: String, default: '' },      // bKash transaction id (on success)
  status:    { type: String, enum: ['pending','completed','failed'], default: 'pending' },
}, {
  timestamps: true,
  collection: 'payments',
});

export default mongoose.model('Payment', paymentSchema);
