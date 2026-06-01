const router = require('express').Router();
const { getLedger, createLedgerEntry, getCustomerBalance, getCustomerList } = require('../controllers');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

router.use(protect);
router.get('/customers', getCustomerList);
router.get('/balance/:customer', getCustomerBalance);
router.route('/').get(getLedger).post(
  authorize('admin', 'manager'),
  [body('customer').notEmpty().trim(), body('transactionType').isIn(['credit', 'debit']), body('amount').isFloat({ min: 0.01 })],
  validate, createLedgerEntry);
module.exports = router;

// Delete ledger entry
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const { CreditLedger } = require('../models');
    const entry = await CreditLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'এন্ট্রি পাওয়া যায়নি।' });
    await CreditLedger.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'এন্ট্রি মুছে গেছে।' });
  } catch (e) { next(e); }
});
