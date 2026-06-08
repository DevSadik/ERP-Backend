'use strict';
const router   = require('express').Router();
const auth     = require('../controllers/shopAuth.controller');
const ctrl     = require('../controllers/shop.controller');
const { protectShop } = require('../middleware/shopAuth');
const upload   = require('../middleware/upload');

// ── Public auth routes ────────────────────────────────────────────────────────
router.post('/register',              auth.register);
router.post('/login',                 auth.login);
router.get('/verify-email/:token',    auth.verifyEmail);
router.post('/resend-verification',   auth.resendVerification);
router.post('/forgot-password',       auth.forgotPassword);
router.post('/reset-password/:token', auth.resetPassword);

// ── Protected routes (shop JWT required) ─────────────────────────────────────
router.use(protectShop);

router.get('/me',  ctrl.shopMe);
router.put('/me',  upload.single('logo'), ctrl.shopUpdateProfile);
router.put('/change-password', ctrl.shopChangePassword);

// Dashboard
router.get('/dashboard/stats',        ctrl.shopDashboardStats);
router.get('/dashboard/weekly-sales', ctrl.shopWeeklySales);

// Products
router.get('/products',               ctrl.shopGetProducts);
router.post('/products',              upload.single('image'), ctrl.shopCreateProduct);
router.put('/products/:id',           upload.single('image'), ctrl.shopUpdateProduct);
router.delete('/products/:id',        ctrl.shopDeleteProduct);
router.get('/products/barcode/:code', ctrl.shopBarcodeLookup);
router.get('/inventory',              ctrl.shopGetInventory);

// Stock In
router.get('/stock-in',  ctrl.shopGetStockIn);
router.post('/stock-in', ctrl.shopCreateStockIn);

// Sales
router.get('/sales',  ctrl.shopGetSales);
router.post('/sales', ctrl.shopCreateSale);

// Credit Ledger
router.get('/ledger',           ctrl.shopGetLedger);
router.post('/ledger',          ctrl.shopCreateLedgerEntry);
router.delete('/ledger/:id',    ctrl.shopDeleteLedgerEntry);
router.get('/ledger/customers', ctrl.shopGetCustomers);

// Suppliers
router.get('/suppliers',  ctrl.shopGetSuppliers);
router.post('/suppliers', ctrl.shopCreateSupplier);

// Notifications
router.get('/notifications', ctrl.shopGetNotifications);

module.exports = router;
