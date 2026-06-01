const router = require('express').Router();
const { getProducts, createProduct, updateProduct, deleteProduct, getCategories } = require('../controllers');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/categories', getCategories);
router.route('/').get(getProducts).post(authorize('admin', 'manager'), upload.single('image'), createProduct);
router.route('/:id').put(authorize('admin', 'manager'), upload.single('image'), updateProduct).delete(authorize('admin'), deleteProduct);
module.exports = router;

// Barcode lookup — must come before /:id
const { lookupBarcode } = require('../controllers');
router.get('/barcode/:code', lookupBarcode);
