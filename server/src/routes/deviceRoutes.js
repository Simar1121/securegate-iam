import express from 'express';
import { getMyDevices, revokeMyDevice } from '../controllers/deviceController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/', getMyDevices);
router.delete('/:id', revokeMyDevice);

export default router;
