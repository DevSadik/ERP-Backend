const router = require('express').Router();
const ctrl   = require('../controllers/shop.controller');
const { protect, authorize } = require('../middleware/auth');

// All admin-central routes require admin user login
router.use(protect, authorize('admin'));

router.get('/central',            ctrl.adminListCentral);
router.post('/central',           ctrl.adminCreateCentralProduct);
router.put('/central/:id',        ctrl.adminUpdateCentralProduct);
router.delete('/central/:id',     ctrl.adminDeleteCentralProduct);
router.get('/central-meta',       ctrl.adminCategories);
router.get('/shops',              ctrl.adminListShops);

module.exports = router;
