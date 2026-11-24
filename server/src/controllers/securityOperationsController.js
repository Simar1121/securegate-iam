import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import Incident from '../models/Incident.js';
import { logAudit } from '../services/auditService.js';

const allowedAlertStatuses = new Set(['Open', 'Acknowledged', 'Resolved']);
const allowedIncidentStatuses = new Set(['Open', 'Investigating', 'Contained', 'Resolved']);

export const getAlerts = async (req, res) => {
  try {
    const { status, severity, limit = 100 } = req.query;
    const filter = {};
    if (status && allowedAlertStatuses.has(status)) filter.status = status;
    if (severity && ['High', 'Critical'].includes(severity)) filter.severity = severity;
    const rows = await Alert.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 200)).lean();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[Security Alerts Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to retrieve security alerts.' });
  }
};

export const updateAlert = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid alert identifier.' });
    const { status } = req.body || {};
    if (!allowedAlertStatuses.has(status)) return res.status(400).json({ success: false, message: 'Unsupported alert status.' });
    const alert = await Alert.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found.' });
    await logAudit({
      req, action: 'SECURITY_ALERT_STATUS_UPDATED', category: 'SECURITY',
      actor: req.user._id, actorEmail: req.user.email, actorName: req.user.fullName,
      actorRole: req.user.role?.name || 'User', targetType: 'System', targetId: alert._id,
      targetName: alert.title, status: 'SUCCESS', details: { newStatus: alert.status },
    });
    return res.json({ success: true, data: alert });
  } catch (error) {
    console.error('[Update Security Alert Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to update security alert.' });
  }
};

export const getIncidents = async (_req, res) => {
  try {
    const rows = await Incident.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[Security Incidents Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to retrieve security incidents.' });
  }
};

export const updateIncident = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid incident identifier.' });
    const { status, resolutionNotes } = req.body || {};
    if (!allowedIncidentStatuses.has(status)) return res.status(400).json({ success: false, message: 'Unsupported incident status.' });
    if (resolutionNotes !== undefined && (typeof resolutionNotes !== 'string' || resolutionNotes.length > 2000)) {
      return res.status(400).json({ success: false, message: 'Resolution notes must be 2,000 characters or fewer.' });
    }
    const update = { status };
    if (resolutionNotes !== undefined) update.resolutionNotes = resolutionNotes;
    const incident = await Incident.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true });
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
    await logAudit({
      req, action: 'SECURITY_INCIDENT_UPDATED', category: 'SECURITY',
      actor: req.user._id, actorEmail: req.user.email, actorName: req.user.fullName,
      actorRole: req.user.role?.name || 'User', targetType: 'System', targetId: incident._id,
      targetName: incident.title, status: 'SUCCESS',
      details: { newStatus: incident.status, resolutionNotesProvided: resolutionNotes !== undefined },
    });
    return res.json({ success: true, data: incident });
  } catch (error) {
    console.error('[Update Security Incident Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to update security incident.' });
  }
};
