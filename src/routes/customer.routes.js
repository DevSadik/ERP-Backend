import { Router } from 'express';
import * as ctrl from '../controllers/customer.controller.js';
import { protectShop } from '../middleware/shopAuth.js';

const router = Router();

// Public
router.get('/public/:token', ctrl.publicView);

// Protected
router.use(protectShop);
router.get('/',                           ctrl.listCustomers);
router.post('/',                          ctrl.createCustomer);
router.get('/:id',                        ctrl.getCustomer);
router.put('/:id',                        ctrl.updateCustomer);
router.delete('/:id',                     ctrl.deleteCustomer);
router.get('/:id/ledger',                 ctrl.getCustomerLedger);
router.post('/:id/ledger',               ctrl.addLedgerEntry);
router.delete('/:id/ledger/:entryId',    ctrl.deleteLedgerEntry);

export default router;
