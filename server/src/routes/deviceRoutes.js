import express from 'express';
import mongoose from 'mongoose';
import Device from '../models/Device.js';
import { getMyDevices, revokeMyDevice } from '../controllers/deviceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAbac } from '../middleware/abacMiddleware.js';

const router = express.Router();
router.use(protect);

// The list endpoint is scoped to the authenticated user in the controller.
// For a specific device, resolve ownership from MongoDB rather than trusting
// request parameters. Foreign/nonexistent devices retain the controller's 404.
const getOwnedDeviceAttributes = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) return {};
  const device = await Device.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).select('userId').lean();

  return device ? { ownerId: device.userId } : {};
};

router.get(
  '/',
  requireAbac('devices:read', 'Device', (req) => ({ ownerId: req.user._id })),
  getMyDevices
);
router.delete(
  '/:id',
  requireAbac('devices:revoke', 'Device', getOwnedDeviceAttributes),
  revokeMyDevice
);

export default router;
