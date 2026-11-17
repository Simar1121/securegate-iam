import express from 'express';
import { getAuditLogs, getAuditStats } from '../controllers/auditController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requirePermission('audit:read'));

router.get('/', getAuditLogs);
router.get('/stats', getAuditStats);

export default router;
