import express from 'express';
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../controllers/roleController.js';
import { protect, requirePermission, requireAnyPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', requireAnyPermission('roles:manage', 'users:create'), getRoles);
router.get('/:id', requireAnyPermission('roles:manage', 'users:create'), getRoleById);
router.post('/', requirePermission('roles:manage'), createRole);
router.put('/:id', requirePermission('roles:manage'), updateRole);
router.delete('/:id', requirePermission('roles:manage'), deleteRole);

export default router;
