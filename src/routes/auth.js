const router = require('express').Router();
const { register, login, getMe, changePassword } = require('../controllers');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

router.post('/register',
  [body('name').notEmpty().trim(), body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 6 })],
  validate, register);

router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate, login);

router.get('/me', protect, getMe);

router.put('/change-password', protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, changePassword);

module.exports = router;
