import express from 'express';
import {
  getPermissions,
  getPermissionMatrix,
  createPermission,
} from '../controllers/permissionController.js';
import { protect, requirePermission, requireAnyPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', requireAnyPermission('permissions:manage', 'roles:manage'), getPermissions);
router.get('/matrix', requireAnyPermission('permissions:manage', 'roles:manage'), getPermissionMatrix);
router.post('/', requirePermission('permissions:manage'), createPermission);

export default router;
