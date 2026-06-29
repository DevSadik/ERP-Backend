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
router.get('/pending',            ctrl.listPending);
router.put('/pending/:id/approve', ctrl.approvePending);
router.put('/pending/:id/reject',  ctrl.rejectPending);
router.get('/shops',              ctrl.listShops);
router.put('/shops/:id/plan',     ctrl.updateShopPlan);

export default router;
