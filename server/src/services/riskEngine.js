const clamp = (score) => Math.max(0, Math.min(100, score));

/**
 * Classify a normalized risk score using the submitted ZeroGate Campus SRS bands.
 * This is an assessment/recommendation only: login enforcement remains on the
 * existing decision threshold until the team approves the SRS action migration.
 */
export const classifyRiskScore = (score) => {
  const normalizedScore = clamp(Number.isFinite(score) ? score : 0);

  if (normalizedScore <= 30) {
    return { level: 'Low', recommendedAction: 'ALLOW' };
  }
  if (normalizedScore <= 60) {
    return { level: 'Medium', recommendedAction: 'REQUIRE_MFA' };
  }
  if (normalizedScore <= 80) {
    return { level: 'High', recommendedAction: 'DENY_OR_ADMIN_REVIEW' };
  }
  return { level: 'Critical', recommendedAction: 'DENY_AND_ALERT' };
};

export const assessLoginRisk = ({ device, ipAddress, userAgent, otpAttempts = 0 }) => {
  const reasons = [];
  let score = 0;

  if (device?.status === 'Blocked') {
    score = 100;
    reasons.push('device_blocked');
  } else if (device?.status === 'Revoked') {
    score = 100;
    reasons.push('device_revoked_reenrollment_denied');
  } else {
    if (!device) {
      score += 35;
      reasons.push('new_device');
    }

    if (device?.lastIpAddress && ipAddress && device.lastIpAddress !== ipAddress) {
      score += 15;
      reasons.push('ip_address_changed');
    }

    if (device?.userAgent && userAgent && device.userAgent !== userAgent) {
      score += 15;
      reasons.push('user_agent_changed');
    }

    if (otpAttempts > 0) {
      const attemptRisk = Math.min(40, otpAttempts * 10);
      score += attemptRisk;
      reasons.push('incorrect_otp_attempts');
    }
  }

  score = clamp(score);
  const classification = classifyRiskScore(score);

  return {
    score,
    ...classification,
    // Backward-compatible enforcement: do not change login outcomes in this
    // classification-only slice. A separately approved policy migration must
    // wire recommendedAction to MFA/review/incident workflows.
    decision: classification.level === 'High' || classification.level === 'Critical' ? 'DENY' : 'ALLOW',
    reasons: reasons.length ? reasons : ['known_device_and_stable_context'],
  };
};
