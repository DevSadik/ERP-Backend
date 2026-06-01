const router = require('express').Router();
const { getDashboardStats, getHourlySales, getWeeklySales } = require('../controllers');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getDashboardStats);
router.get('/hourly-sales', getHourlySales);
router.get('/weekly-sales', getWeeklySales);
module.exports = router;
