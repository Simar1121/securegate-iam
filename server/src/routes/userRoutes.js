import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserStatus,
} from '../controllers/userController.js';
import { protect, requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All user management endpoints require authentication

router.get('/', requirePermission('users:read'), getUsers);
router.get('/:id', requirePermission('users:read'), getUserById);
router.post('/', requirePermission('users:create'), createUser);
router.put('/:id', requirePermission('users:update'), updateUser);
router.delete('/:id', requirePermission('users:delete'), deleteUser);
router.patch('/:id/status', requirePermission('users:update'), updateUserStatus);

export default router;
