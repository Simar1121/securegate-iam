const clamp = (score) => Math.max(0, Math.min(100, score));

export const assessLoginRisk = ({ device, ipAddress, userAgent, otpAttempts = 0 }) => {
  const reasons = [];
  let score = 0;

  if (device?.status === 'Blocked') {
    return { score: 100, level: 'High', decision: 'DENY', reasons: ['device_blocked'] };
  }

  if (!device) {
    score += 35;
    reasons.push('new_device');
  } else if (device.status === 'Revoked') {
    score += 20;
    reasons.push('previously_revoked_device_reenrollment');
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

  score = clamp(score);
  const level = score >= 70 ? 'High' : score >= 30 ? 'Medium' : 'Low';

  return {
    score,
    level,
    decision: score >= 70 ? 'DENY' : 'ALLOW',
    reasons: reasons.length ? reasons : ['known_device_and_stable_context'],
  };
};
