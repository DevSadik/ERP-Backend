import mongoose from 'mongoose';

const stockInSchema = new mongoose.Schema({
  shop:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  batchNo:     { type: String, required: true },
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity:    { type: Number, required: true, min: 0 },
  supplier:    { type: String },
  costTotal:   { type: Number, default: 0 },
  purchaseDate:{ type: Date, default: Date.now },
  expiryDate:  { type: Date },
  notes:       { type: String },
  status:      { type: String, enum: ['pending','received','cancelled'], default: 'received' },
  receivedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockInSchema.index({ shop: 1, createdAt: -1 });

export default mongoose.model('StockIn', stockInSchema);
