import mongoose from 'mongoose';

const creditLedgerSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  customer:        { type: String, required: true, trim: true },
  transactionType: { type: String, enum: ['credit','debit'], required: true },
  amount:          { type: Number, required: true, min: 0 },
  balance:         { type: Number, default: 0 },
  reference:       { type: String },
  notes:           { type: String },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

creditLedgerSchema.index({ shop: 1, customer: 1, createdAt: -1 });

export default mongoose.model('CreditLedger', creditLedgerSchema);
