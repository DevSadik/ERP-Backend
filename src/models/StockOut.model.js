import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:       { type: String },
  quantity:   { type: Number, required: true },
  salePrice:  { type: Number, required: true },
  costPrice:  { type: Number, default: 0 },
  total:      { type: Number, required: true },
}, { _id: false });

const stockOutSchema = new mongoose.Schema({
  shop:          { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  orderId:       { type: String, required: true },
  customer:      { type: String, default: 'Walk-in' },
  items:         [itemSchema],
  totalAmount:   { type: Number, required: true },
  discount:      { type: Number, default: 0 },
  paymentType:   { type: String, enum: ['cash','credit','transfer','bkash','nagad'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid','partial','unpaid'], default: 'paid' },
  notes:         { type: String },
  processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockOutSchema.index({ shop: 1, createdAt: -1 });
stockOutSchema.index({ shop: 1, customer: 1 });

export default mongoose.model('StockOut', stockOutSchema);
