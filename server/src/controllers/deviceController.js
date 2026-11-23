import mongoose from 'mongoose';
import Device from '../models/Device.js';
import { logAudit } from '../services/auditService.js';

export const getMyDevices = async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user._id })
      .select('deviceName platform userAgent status trustScore lastRiskScore lastRiskLevel firstSeenAt lastSeenAt lastLoginAt lastIpAddress revokedAt')
      .sort({ lastSeenAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: devices.map((device) => ({
        ...device,
        isCurrentDevice: device._id.toString() === req.device?._id?.toString(),
      })),
    });
  } catch (error) {
    console.error('[Get Devices Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to retrieve trusted devices.' });
  }
};

export const revokeMyDevice = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid device identifier.' });
    }

    const device = await Device.findOne({ _id: req.params.id, userId: req.user._id });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found for this account.' });
    }
    if (device.status === 'Revoked') {
      return res.json({ success: true, message: 'This device has already been revoked.' });
    }

    device.status = 'Revoked';
    device.revokedAt = new Date();
    device.trustScore = 0;
    await device.save();

    await logAudit({
      req,
      action: 'DEVICE_REVOKED',
      category: 'SECURITY',
      actor: req.user._id,
      actorEmail: req.user.email,
      actorName: req.user.fullName,
      actorRole: req.user.role?.name || 'User',
      targetType: 'Device',
      targetId: device._id,
      targetName: device.deviceName,
      status: 'SUCCESS',
      details: { sessionsInvalidated: true },
    });

    return res.json({ success: true, message: 'Device access revoked. Sessions issued to this device are now blocked.' });
  } catch (error) {
    console.error('[Revoke Device Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to revoke this device.' });
  }
};
