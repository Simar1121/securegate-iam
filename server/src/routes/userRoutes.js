import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  resendInvitation,
  updateUser,
  deleteUser,
  updateUserStatus,
} from '../controllers/userController.js';
import { protect, requirePermission, requireRole } from '../middleware/authMiddleware.js';
import { requireAbac } from '../middleware/abacMiddleware.js';

const router = express.Router();

router.use(protect); // All user management endpoints require authentication

// Do not derive resource.ownerId from an untrusted URL parameter. Add it only
// after loading the authoritative target record in a resource-aware middleware.
router.get('/', requirePermission('users:read'), requireAbac('users:read', 'User'), getUsers);
router.get('/:id', requirePermission('users:read'), requireAbac('users:read', 'User'), getUserById);
router.post('/', requireRole('Super Admin', 'IT Administrator'), requireAbac('users:create', 'User'), createUser);
router.post('/:id/resend-invitation', requireRole('Super Admin', 'IT Administrator'), requireAbac('users:update', 'User'), resendInvitation);
router.put('/:id', requirePermission('users:update'), requireAbac('users:update', 'User'), updateUser);
router.delete('/:id', requirePermission('users:delete'), requireAbac('users:delete', 'User'), deleteUser);
router.patch('/:id/status', requirePermission('users:update'), requireAbac('users:update', 'User'), updateUserStatus);

export default router;
