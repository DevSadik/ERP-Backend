const mongoose = require('mongoose');
const crypto   = require('crypto');

// ── Customer ──────────────────────────────────────────────────────────────────
const customerSchema = new mongoose.Schema({
  shop:            { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name:            { type: String, required: true, trim: true },
  phone:           { type: String, trim: true },
  address:         { type: String, trim: true },
  previousBalance: { type: Number, default: 0 },   // আগের বাকি (opening balance)
  notes:           { type: String },
  isActive:        { type: Boolean, default: true },
  // Public token — গ্রাহক এই token দিয়ে নিজের account দেখবে
  publicToken:     { type: String, unique: true, sparse: true },
}, { timestamps: true, toJSON: { virtuals: true } });

// Auto-generate public token on creation
customerSchema.pre('save', function(next) {
  if (!this.publicToken) {
    this.publicToken = crypto.randomBytes(20).toString('hex');
  }
  next();
});

// Virtual: total balance (calculated from ledger entries)
// Used in aggregation — not stored

customerSchema.index({ shop: 1, name: 1 });
customerSchema.index({ shop: 1, phone: 1 });
customerSchema.index({ publicToken: 1 });

// ── Customer Ledger Entry ─────────────────────────────────────────────────────
const customerLedgerSchema = new mongoose.Schema({
  shop:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },

  // Entry type
  type: {
    type: String,
    enum: ['sale', 'payment', 'return', 'opening'],
    required: true,
  },

  // Product (optional — from barcode scan)
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },           // stored for history even if product deleted
  barcode:     { type: String },
  quantity:    { type: Number, default: 1 },
  unitPrice:   { type: Number, default: 0 },

  // Money
  totalAmount:  { type: Number, required: true },  // total of this transaction
  paidAmount:   { type: Number, default: 0 },      // paid in this transaction
  dueAmount:    { type: Number, default: 0 },      // totalAmount - paidAmount
  balance:      { type: Number, required: true },  // running balance after this entry

  notes:        { type: String },

  // Date — auto or custom
  entryDate:    { type: Date, default: Date.now },

}, { timestamps: true });

customerLedgerSchema.index({ shop: 1, customer: 1, entryDate: -1 });
customerLedgerSchema.index({ shop: 1, customer: 1, type: 1 });

module.exports = {
  Customer:       mongoose.model('Customer',       customerSchema),
  CustomerLedger: mongoose.model('CustomerLedger', customerLedgerSchema),
};
