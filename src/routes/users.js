const router = require('express').Router();
const { getUsers, createUser, updateUser } = require('../controllers');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));
router.route('/').get(getUsers).post(createUser);
router.put('/:id', updateUser);
module.exports = router;
