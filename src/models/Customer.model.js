import mongoose from 'mongoose';
import crypto   from 'crypto';

const customerSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name:            { type: String, required: true, trim: true },
  phone:           { type: String, trim: true },
  address:         { type: String, trim: true },
  previousBalance: { type: Number, default: 0 },
  notes:           { type: String },
  isActive:        { type: Boolean, default: true },
  publicToken:     { type: String, unique: true, sparse: true },
}, { timestamps: true, toJSON: { virtuals: true } });

customerSchema.pre('save', function(next) {
  if (!this.publicToken) this.publicToken = crypto.randomBytes(20).toString('hex');
  next();
});

customerSchema.index({ shop: 1, name: 1 });
customerSchema.index({ shop: 1, phone: 1 });
customerSchema.index({ publicToken: 1 });

export default mongoose.model('Customer', customerSchema);
