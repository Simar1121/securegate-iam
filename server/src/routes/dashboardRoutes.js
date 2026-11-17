import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/stats', requirePermission('users:read'), getDashboardStats);

export default router;
