import express from 'express';
import {
  getAlerts, updateAlert, getIncidents, updateIncident,
} from '../controllers/securityOperationsController.js';
import {
  requireSecurityAlertRead, requireSecurityAlertManage,
} from '../middleware/securityOperationsMiddleware.js';

const router = express.Router();

router.get('/alerts', ...requireSecurityAlertRead, getAlerts);
router.patch('/alerts/:id', ...requireSecurityAlertManage, updateAlert);
router.get('/incidents', ...requireSecurityAlertRead, getIncidents);
router.patch('/incidents/:id', ...requireSecurityAlertManage, updateIncident);

export default router;
