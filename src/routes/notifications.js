const router = require('express').Router();
const { getNotifications, markNotificationsRead } = require('../controllers');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getNotifications);
router.put('/read-all', markNotificationsRead);
module.exports = router;
