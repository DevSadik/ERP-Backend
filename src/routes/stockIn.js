const router = require('express').Router();
const { getStockIn, createStockIn, updateStockIn } = require('../controllers');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

router.use(protect);
router.route('/').get(getStockIn).post(
  authorize('admin', 'manager'),
  [body('product').isMongoId(), body('quantity').isInt({ min: 1 }), body('supplier').notEmpty().trim(), body('costTotal').isFloat({ min: 0 })],
  validate, createStockIn);
router.put('/:id', authorize('admin', 'manager'), updateStockIn);
module.exports = router;
