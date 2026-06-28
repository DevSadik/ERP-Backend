import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect, authorize('admin'));

router.get('/central',            ctrl.listCentral);
router.get('/central/barcode/:code', ctrl.lookupCentralBarcode);
router.post('/central',           ctrl.createCentral);
router.put('/central/:id',        ctrl.updateCentral);
router.delete('/central/:id',     ctrl.deleteCentral);
router.get('/central-meta',       ctrl.getCentralMeta);
router.get('/shops',              ctrl.listShops);
router.put('/shops/:id/plan',     ctrl.updateShopPlan);

export default router;
