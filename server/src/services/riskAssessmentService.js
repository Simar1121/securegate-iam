import RiskEvent from '../models/RiskEvent.js';
import Alert from '../models/Alert.js';
import Incident from '../models/Incident.js';

/**
 * Persist every assessed login risk. High/Critical outcomes create a review alert;
 * Critical outcomes additionally create an incident. Persistence errors propagate
 * so callers can fail closed instead of silently issuing a session without evidence.
 */
export const createRiskAssessmentRecorder = ({
  RiskEventModel = RiskEvent,
  AlertModel = Alert,
  IncidentModel = Incident,
} = {}) => async ({ user, device, risk, ipAddress = '', userAgent = '', assessedAt = new Date() }) => {
  const event = await RiskEventModel.create({
    userId: user._id,
    deviceId: device?._id || null,
    score: risk.score,
    level: risk.level,
    recommendedAction: risk.recommendedAction,
    enforcementDecision: risk.decision,
    reasons: risk.reasons,
    ipAddress,
    userAgent,
    assessedAt,
  });

  if (risk.level === 'High' || risk.level === 'Critical') {
    const isCritical = risk.level === 'Critical';
    const createdAlert = await AlertModel.create({
      type: isCritical ? 'CRITICAL_LOGIN_RISK' : 'HIGH_LOGIN_RISK_REVIEW',
      severity: risk.level,
      title: isCritical ? 'Critical login risk blocked' : 'High-risk login requires review',
      description: isCritical
        ? 'A login attempt reached the Critical risk band and was denied. Review the risk event and device context.'
        : 'A login attempt reached the High risk band and was denied pending administrator/security review.',
      status: 'Open',
      userId: user._id,
      deviceId: device?._id || null,
      riskEventId: event._id,
      metadata: { score: risk.score, reasons: risk.reasons, recommendedAction: risk.recommendedAction },
    });

    if (isCritical) {
      await IncidentModel.create({
        alertId: createdAlert._id,
        title: 'Critical login risk event',
        severity: 'Critical',
        status: 'Open',
        source: 'RISK_ENGINE',
        userId: user._id,
        deviceId: device?._id || null,
        riskEventId: event._id,
        summary: 'Critical risk assessment triggered an automatic login denial and incident record.',
      });
    }
  }

  return event;
};

export const recordRiskAssessment = createRiskAssessmentRecorder();
