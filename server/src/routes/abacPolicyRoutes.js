import express from 'express';
import { protect, requireRole } from '../middleware/authMiddleware.js';
import { listAbacPolicies, createAbacPolicy, updateAbacPolicy, deleteAbacPolicy, simulateAbacPolicy } from '../controllers/abacPolicyController.js';

const router = express.Router();
router.use(protect, requireRole('Super Admin'));
router.get('/', listAbacPolicies);
router.post('/', createAbacPolicy);
router.post('/simulate', simulateAbacPolicy);
router.put('/:id', updateAbacPolicy);
router.delete('/:id', deleteAbacPolicy);

export default router;
