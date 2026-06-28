import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  shop:         { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
  sku:          { type: String, required: true, trim: true },
  name:         { type: String, required: true, trim: true },
  barcode:      { type: String, trim: true },
  company:      { type: String, trim: true },
  mrp:          { type: Number, default: 0 },
  category:     { type: String, trim: true, default: 'সাধারণ' },
  unit:         { type: String, enum: ['pcs','packs','boxes','bags','kg','g','litres'], default: 'pcs' },
  costPrice:    { type: Number, default: 0 },
  salePrice:    { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 50 },
  images:       [{ type: String }],
  description:  { type: String },
  isActive:     { type: Boolean, default: true },
  isCentral:    { type: Boolean, default: false },
}, { timestamps: true, toJSON: { virtuals: true } });

productSchema.virtual('stockStatus').get(function() {
  if (this.currentStock <= 0)              return 'out';
  if (this.currentStock <= this.reorderLevel) return 'low';
  return 'ok';
});

// Indexes for performance
productSchema.index({ shop: 1, barcode: 1 });
productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ isCentral: 1, barcode: 1 });
productSchema.index({ shop: 1, category: 1 });

export default mongoose.model('Product', productSchema);
