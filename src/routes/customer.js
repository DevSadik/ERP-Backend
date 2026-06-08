'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/customer.controller');
const { protectShop } = require('../middleware/shopAuth');

// ── Public route — no auth ────────────────────────────────────────────────────
router.get('/public/:token', ctrl.publicCustomerView);

// ── All below require shop auth ───────────────────────────────────────────────
router.use(protectShop);

// Customer CRUD
router.get('/',      ctrl.listCustomers);
router.post('/',     ctrl.createCustomer);
router.get('/:id',   ctrl.getCustomer);
router.put('/:id',   ctrl.updateCustomer);
router.delete('/:id', ctrl.deleteCustomer);

// Customer ledger entries
router.get('/:id/ledger',              ctrl.getCustomerLedger);
router.post('/:id/ledger',             ctrl.addLedgerEntry);
router.delete('/:id/ledger/:entryId',  ctrl.deleteLedgerEntry);

module.exports = router;
