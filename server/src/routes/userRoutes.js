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

router.get('/', requirePermission('users:read'), requireAbac('users:read', 'User'), getUsers);
router.get('/:id', requirePermission('users:read'), requireAbac('users:read', 'User', req => ({ ownerId: req.params.id })), getUserById);
router.post('/', requireRole('Super Admin', 'IT Administrator'), requireAbac('users:create', 'User'), createUser);
router.post('/:id/resend-invitation', requireRole('Super Admin', 'IT Administrator'), requireAbac('users:update', 'User', req => ({ ownerId: req.params.id })), resendInvitation);
router.put('/:id', requirePermission('users:update'), requireAbac('users:update', 'User', req => ({ ownerId: req.params.id })), updateUser);
router.delete('/:id', requirePermission('users:delete'), requireAbac('users:delete', 'User', req => ({ ownerId: req.params.id })), deleteUser);
router.patch('/:id/status', requirePermission('users:update'), requireAbac('users:update', 'User', req => ({ ownerId: req.params.id })), updateUserStatus);

export default router;
