import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  shop:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:    { type: String, enum: ['info','warning','success','error'], default: 'info' },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
