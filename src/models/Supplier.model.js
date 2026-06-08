import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  shop:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
  name:    { type: String, required: true, trim: true },
  email:   { type: String, trim: true },
  phone:   { type: String, trim: true },
  address: { type: String },
  isActive:{ type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Supplier', supplierSchema);
