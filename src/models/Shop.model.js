import mongoose from 'mongoose';
import bcrypt   from 'bcryptjs';

const shopSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  ownerName:    { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6, select: false },
  phone:        { type: String, trim: true },
  address:      { type: String },
  logo:         { type: String },
  businessType: { type: String, default: 'মিষ্টান্ন' },
  isActive:     { type: Boolean, default: true },
  plan:         { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
  trialEnds:    { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  planExpires:  { type: Date },   // when a paid plan (pro/basic) expires
  lastLogin:    { type: Date },
  // Email verification
  isEmailVerified:    { type: Boolean, default: false },
  emailVerifyToken:   { type: String },
  emailVerifyExpires: { type: Date },
  // Password reset
  passwordResetToken:   { type: String },
  passwordResetExpires: { type: Date },
  // Phone verification (OTP via SMS)
  isPhoneVerified:  { type: Boolean, default: false },
  phoneOtp:         { type: String },
  phoneOtpExpires:  { type: Date },
}, { timestamps: true, toJSON: { virtuals: true } });

shopSchema.virtual('trialDaysLeft').get(function() {
  return Math.max(0, Math.ceil((this.trialEnds - Date.now()) / (1000 * 60 * 60 * 24)));
});

// Days left on a paid plan
shopSchema.virtual('planDaysLeft').get(function() {
  if (!this.planExpires) return 0;
  return Math.max(0, Math.ceil((this.planExpires - Date.now()) / (1000 * 60 * 60 * 24)));
});

// True when access should be blocked (trial ended AND no active paid plan)
shopSchema.virtual('isExpired').get(function() {
  if (this.plan === 'trial') {
    return this.trialEnds < new Date();
  }
  // paid plan: expired if planExpires passed
  return this.planExpires ? this.planExpires < new Date() : false;
});

shopSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

shopSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model('Shop', shopSchema);
