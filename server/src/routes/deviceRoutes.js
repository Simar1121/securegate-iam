import express from 'express';
import mongoose from 'mongoose';
import Device from '../models/Device.js';
import { getMyDevices, revokeMyDevice } from '../controllers/deviceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAbac } from '../middleware/abacMiddleware.js';
import { createOwnedDeviceAttributesResolver } from '../services/deviceAbacResource.js';

const router = express.Router();
router.use(protect);

const getOwnedDeviceAttributes = createOwnedDeviceAttributesResolver({
  Device,
  isValidObjectId: mongoose.isValidObjectId,
});

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
