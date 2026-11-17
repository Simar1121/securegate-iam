import express from 'express';
import { getSetupStatus, initializeOrganization } from '../controllers/setupController.js';

const router = express.Router();
router.get('/status', getSetupStatus);
router.post('/initialize', initializeOrganization);
export default router;
