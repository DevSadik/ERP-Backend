const router = require('express').Router();
const { getStockOut, createStockOut } = require('../controllers');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

router.use(protect);
router.route('/').get(getStockOut).post(
  [body('items').isArray({ min: 1 }), body('items.*.product').isMongoId(), body('items.*.quantity').isInt({ min: 1 }), body('items.*.salePrice').isFloat({ min: 0 }), body('items.*.subtotal').isFloat({ min: 0 }), body('totalAmount').isFloat({ min: 0 })],
  validate, createStockOut);
module.exports = router;
