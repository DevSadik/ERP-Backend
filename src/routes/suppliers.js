const router = require('express').Router();
const { getSuppliers, createSupplier, updateSupplier, deleteSupplier } = require('../controllers');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getSuppliers).post(authorize('admin', 'manager'), createSupplier);
router.route('/:id').put(authorize('admin', 'manager'), updateSupplier).delete(authorize('admin'), deleteSupplier);
module.exports = router;
