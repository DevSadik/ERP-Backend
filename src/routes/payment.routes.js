import { Router } from 'express';
import * as ctrl from '../controllers/payment.controller.js';
import { protectShop } from '../middleware/shopAuth.js';

const router = Router();

// Public: bKash calls this after the user finishes payment
router.get('/callback', ctrl.paymentCallback);

// Shop must be logged in to start a payment or view plans
router.get('/plans',  protectShop, ctrl.getPlans);
router.post('/start', protectShop, ctrl.startPayment);

export default router;
