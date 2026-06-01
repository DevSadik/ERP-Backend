const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── User ─────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6, select: false },
  role:      { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
  branch:    { type: String, default: 'main' },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Product ───────────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema({
  sku:          { type: String, required: true, unique: true, uppercase: true, trim: true },
  name:         { type: String, required: true, trim: true },
  category:     { type: String, required: true, trim: true },
  unit:         { type: String, enum: ['pcs','packs','boxes','bags','kg','g','litres'], default: 'pcs' },
  costPrice:    { type: Number, required: true, min: 0 },
  salePrice:    { type: Number, required: true, min: 0 },
  reorderLevel: { type: Number, default: 50 },
  currentStock: { type: Number, default: 0 },
  image:        { type: String },
  barcode:      { type: String, trim: true },
  company:      { type: String, trim: true },
  mrp:          { type: Number, default: 0 },
  description:  { type: String },
  isActive:     { type: Boolean, default: true },
  isCentral:    { type: Boolean, default: false },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
}, { timestamps: true });

productSchema.virtual('stockStatus').get(function() {
  if (this.currentStock === 0)               return 'out_of_stock';
  if (this.currentStock < this.reorderLevel) return 'low';
  if (this.currentStock < this.reorderLevel * 2) return 'moderate';
  return 'healthy';
});
productSchema.set('toJSON', { virtuals: true });

// ── Supplier ──────────────────────────────────────────────────────────────────
const supplierSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, trim: true, lowercase: true },
  phone:   { type: String, trim: true },
  address: { type: String },
  notes:   { type: String },
  isActive:{ type: Boolean, default: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
}, { timestamps: true });

// ── StockIn ───────────────────────────────────────────────────────────────────
const stockInSchema = new mongoose.Schema({
  batchNo:    { type: String, unique: true },
  product:    { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity:   { type: Number, required: true, min: 1 },
  supplier:   { type: String, required: true, trim: true },
  costTotal:  { type: Number, required: true, min: 0 },
  expiryDate: { type: Date },
  purchaseDate: { type: Date, default: Date.now },
  notes:      { type: String },
  status:     { type: String, enum: ['pending','received','cancelled'], default: 'received' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
}, { timestamps: true });

stockInSchema.pre('save', async function(next) {
  if (!this.batchNo) {
    const count = await mongoose.model('StockIn').countDocuments();
    this.batchNo = `SI-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

// ── StockOut ──────────────────────────────────────────────────────────────────
const stockOutSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  items: [{
    product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:  { type: Number, required: true, min: 1 },
    salePrice: { type: Number, required: true },
    subtotal:  { type: Number, required: true },
  }],
  customer:      { type: String, default: 'Walk-in' },
  totalAmount:   { type: Number, required: true },
  discount:      { type: Number, default: 0 },
  paymentType:   { type: String, enum: ['cash','credit','transfer'], default: 'cash' },
  paymentStatus: { type: String, enum: ['paid','pending','partial'], default: 'paid' },
  notes:         { type: String },
  processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
}, { timestamps: true });

stockOutSchema.pre('save', async function(next) {
  if (!this.orderId) {
    const count = await mongoose.model('StockOut').countDocuments();
    this.orderId = `#SO-${String(count + 1001).padStart(4, '0')}`;
  }
  next();
});

// ── CreditLedger ──────────────────────────────────────────────────────────────
const ledgerSchema = new mongoose.Schema({
  customer:        { type: String, required: true, trim: true },
  transactionType: { type: String, enum: ['credit', 'debit'], required: true },
  amount:          { type: Number, required: true, min: 0.01 },
  balance:         { type: Number, required: true },
  reference:       { type: String },
  notes:           { type: String },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', index: true },
}, { timestamps: true });

// ── Notification ──────────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  type:    { type: String, enum: ['info','warning','error','success'], default: 'info' },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  link:    { type: String },
}, { timestamps: true });



// ── Brand (Supplier Company) ───────────────────────────────────────────────────
const brandSchema = new mongoose.Schema({
  companyName:   { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:      { type: String, required: true, minlength: 6, select: false },
  phone:         { type: String, trim: true },
  address:       { type: String, trim: true },
  logo:          { type: String },
  website:       { type: String },
  description:   { type: String },
  tradeCategory: { type: String },
  status:        { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
  isVerified:    { type: Boolean, default: false },
  totalProducts: { type: Number, default: 0 },
  lastLogin:     { type: Date },
}, { timestamps: true });

brandSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
brandSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Global Product Registry ────────────────────────────────────────────────────
const registryProductSchema = new mongoose.Schema({
  brand:          { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  barcode:        { type: String, required: true, trim: true },
  name:           { type: String, required: true, trim: true },
  nameBn:         { type: String, trim: true },
  category:       { type: String, required: true, trim: true },
  unit:           { type: String, enum: ['pcs','packs','boxes','bags','kg','g','litres'], default: 'pcs' },
  mrp:            { type: Number, required: true, min: 0 },
  tradePrice:     { type: Number, required: true, min: 0 },
  pcsPerCarton:   { type: Number, default: 1 },
  weight:         { type: String },
  description:    { type: String },
  images:         [{ type: String }],
  barcodeImage:   { type: String },
  status:         { type: String, enum: ['active', 'pending', 'rejected'], default: 'pending' },
  rejectedReason: { type: String },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

// Ensure barcode unique per brand
registryProductSchema.index({ barcode: 1, brand: 1 }, { unique: true });
registryProductSchema.index({ barcode: 1 });


// ── Performance indexes (for many concurrent shops/clients) ──────────────────
productSchema.index({ shop: 1, barcode: 1 });
productSchema.index({ shop: 1, isActive: 1 });
productSchema.index({ isCentral: 1, barcode: 1 });
stockInSchema.index({ shop: 1, createdAt: -1 });
stockOutSchema.index({ shop: 1, createdAt: -1 });
ledgerSchema.index({ shop: 1, customer: 1, createdAt: -1 });

module.exports = {
  User:             mongoose.model('User',             userSchema),
  Product:          mongoose.model('Product',          productSchema),
  Supplier:         mongoose.model('Supplier',         supplierSchema),
  StockIn:          mongoose.model('StockIn',          stockInSchema),
  StockOut:         mongoose.model('StockOut',         stockOutSchema),
  CreditLedger:     mongoose.model('CreditLedger',     ledgerSchema),
  Notification:     mongoose.model('Notification',     notificationSchema),
  Brand:            mongoose.model('Brand',            brandSchema),
  RegistryProduct:  mongoose.model('RegistryProduct',  registryProductSchema),
};

// ── Shop (Tenant) ─────────────────────────────────────────────────────────────
const shopSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  ownerName:   { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true, minlength: 6, select: false },
  phone:       { type: String, trim: true },
  address:     { type: String },
  logo:        { type: String },
  businessType:{ type: String, default: 'মিষ্টান্ন' },
  isActive:    { type: Boolean, default: true },
  isApproved:  { type: Boolean, default: true }, // auto approve for now
  trialEnds:   { type: Date, default: () => new Date(Date.now() + 15*24*60*60*1000) },
  plan:        { type: String, enum: ['trial','basic','pro'], default: 'trial' },
  lastLogin:   { type: Date },
}, { timestamps: true });

shopSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
shopSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};
shopSchema.virtual('trialDaysLeft').get(function() {
  const diff = this.trialEnds - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});
shopSchema.set('toJSON', { virtuals: true });

module.exports.Shop = mongoose.model('Shop', shopSchema);
