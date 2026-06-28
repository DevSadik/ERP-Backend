import mongoose from 'mongoose';

const customerLedgerSchema = new mongoose.Schema({
  shop:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type:        { type: String, enum: ['sale','payment','return','opening'], required: true },
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  barcode:     { type: String },
  quantity:    { type: Number, default: 1 },
  unitPrice:   { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paidAmount:  { type: Number, default: 0 },
  dueAmount:   { type: Number, default: 0 },
  balance:     { type: Number, required: true },
  notes:       { type: String },
  entryDate:   { type: Date, default: Date.now },
}, { timestamps: true });

customerLedgerSchema.index({ shop: 1, customer: 1, entryDate: -1 });

export default mongoose.model('CustomerLedger', customerLedgerSchema);
