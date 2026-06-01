const router  = require('express').Router();
const ctrl    = require('../controllers/brand.controller');
const { protect, authorize } = require('../middleware/auth');
const { protectBrand } = require('../middleware/brandAuth');
const upload  = require('../middleware/upload');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

// ── Public ─────────────────────────────────────────────────────────────────
router.post('/register',
  upload.single('logo'),
  [body('companyName').notEmpty().trim(), body('email').isEmail(), body('password').isLength({ min: 6 })],
  validate, ctrl.brandRegister);

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate, ctrl.brandLogin);

// ── Registry (protected by user JWT for stock-in use) ─────────────────────
router.get('/registry/lookup/:code', protect, ctrl.registryLookup);
router.get('/registry/search',       protect, ctrl.registrySearch);

// ── Brand dashboard (brand JWT) ───────────────────────────────────────────
router.get('/me',           protectBrand, ctrl.brandMe);
router.put('/me',           protectBrand, upload.single('logo'), ctrl.brandUpdateProfile);
router.get('/products',     protectBrand, ctrl.brandGetProducts);
router.post('/products',    protectBrand, upload.array('images', 5), ctrl.brandCreateProduct);
router.put('/products/:id', protectBrand, upload.array('images', 5), ctrl.brandUpdateProduct);
router.delete('/products/:id', protectBrand, ctrl.brandDeleteProduct);

// ── Admin ─────────────────────────────────────────────────────────────────
router.get('/admin/brands',              protect, authorize('admin'), ctrl.adminGetBrands);
router.put('/admin/brands/:id/status',   protect, authorize('admin'), ctrl.adminApproveBrand);
router.get('/admin/products',            protect, authorize('admin'), ctrl.adminGetRegistryProducts);
router.put('/admin/products/:id/status', protect, authorize('admin'), ctrl.adminApproveProduct);

module.exports = router;
