import { Router } from 'express';
import * as auth from '../controllers/shopAuth.controller.js';
import * as shop from '../controllers/shop.controller.js';
import { protectShop } from '../middleware/shopAuth.js';
import upload from '../middleware/upload.js';

const router = Router();

// Public
router.post('/register',        auth.register);
router.post('/login',           auth.login);
router.post('/verify-otp',      auth.verifyOtp);
router.post('/resend-otp',      auth.resendOtp);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password',  auth.resetPassword);

// Protected
router.use(protectShop);
router.get('/me',              shop.getMe);
router.put('/me',              upload.single('logo'), shop.updateMe);
router.put('/change-password', shop.changePassword);

router.get('/dashboard/stats',        shop.getDashboardStats);
router.get('/dashboard/weekly-sales', shop.getWeeklySales);

router.get('/products',               shop.getProducts);
router.post('/products',              upload.single('image'), shop.createProduct);
router.put('/products/:id',           upload.single('image'), shop.updateProduct);
router.delete('/products/:id',        shop.deleteProduct);
router.get('/products/barcode/:code', shop.lookupBarcode);
router.get('/inventory',              shop.getInventory);

router.get('/stock-in',  shop.getStockIn);
router.post('/stock-in', shop.createStockIn);

router.get('/sales',  shop.getSales);
router.post('/sales', shop.createSale);

router.get('/ledger',           shop.getLedger);
router.post('/ledger',          shop.createLedgerEntry);
router.delete('/ledger/:id',    shop.deleteLedgerEntry);
router.get('/ledger/customers', shop.getLedgerCustomers);

router.get('/suppliers',  shop.getSuppliers);
router.post('/suppliers', shop.createSupplier);

router.get('/notifications', shop.getNotifications);

export default router;
