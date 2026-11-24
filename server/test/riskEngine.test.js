import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLoginRisk, classifyRiskScore } from '../src/services/riskEngine.js';

const knownDevice = {
  status: 'Trusted',
  lastIpAddress: '203.0.113.10',
  userAgent: 'SecureGate Test Browser',
};

test('SRS risk bands classify every required boundary correctly', () => {
  const cases = [
    [0, 'Low', 'ALLOW'],
    [30, 'Low', 'ALLOW'],
    [31, 'Medium', 'REQUIRE_MFA'],
    [60, 'Medium', 'REQUIRE_MFA'],
    [61, 'High', 'DENY_OR_ADMIN_REVIEW'],
    [80, 'High', 'DENY_OR_ADMIN_REVIEW'],
    [81, 'Critical', 'DENY_AND_ALERT'],
    [100, 'Critical', 'DENY_AND_ALERT'],
  ];

  for (const [score, level, recommendedAction] of cases) {
    assert.deepEqual(classifyRiskScore(score), { level, recommendedAction });
  }
});

test('risk score classifier clamps out-of-range values', () => {
  assert.deepEqual(classifyRiskScore(-10), { level: 'Low', recommendedAction: 'ALLOW' });
  assert.deepEqual(classifyRiskScore(150), { level: 'Critical', recommendedAction: 'DENY_AND_ALERT' });
});

test('known trusted device with stable context is low risk and allowed', () => {
  assert.deepEqual(assessLoginRisk({
    device: knownDevice,
    ipAddress: '203.0.113.10',
    userAgent: 'SecureGate Test Browser',
  }), {
    score: 0,
    level: 'Low',
    recommendedAction: 'ALLOW',
    decision: 'ALLOW',
    reasons: ['known_device_and_stable_context'],
  });
});

test('new device adds 35 points and recommends MFA without changing current enforcement', () => {
  const result = assessLoginRisk({ device: null });
  assert.equal(result.score, 35);
  assert.equal(result.level, 'Medium');
  assert.equal(result.recommendedAction, 'REQUIRE_MFA');
  assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.reasons, ['new_device']);
});

test('IP and user-agent changes add independent risk signals', () => {
  const result = assessLoginRisk({
    device: knownDevice,
    ipAddress: '198.51.100.22',
    userAgent: 'Different Browser',
  });
  assert.equal(result.score, 30);
  assert.equal(result.level, 'Low');
  assert.equal(result.recommendedAction, 'ALLOW');
  assert.deepEqual(result.reasons, ['ip_address_changed', 'user_agent_changed']);
});

test('OTP attempt risk is capped at 40 points', () => {
  const result = assessLoginRisk({ device: knownDevice, otpAttempts: 99 });
  assert.equal(result.score, 40);
  assert.equal(result.level, 'Medium');
  assert.equal(result.recommendedAction, 'REQUIRE_MFA');
  assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.reasons, ['incorrect_otp_attempts']);
});

test('risk score of 61 enters high band and is denied for review', () => {
  const result = assessLoginRisk({ device: knownDevice, otpAttempts: 7 });
  assert.equal(result.score, 70);
  assert.equal(result.level, 'High');
  assert.equal(result.decision, 'DENY');
});

test('risk score of 70 is high and remains denied by current enforcement', () => {
  const result = assessLoginRisk({
    device: knownDevice,
    ipAddress: '198.51.100.22',
    userAgent: 'Different Browser',
    otpAttempts: 4,
  });
  assert.equal(result.score, 70);
  assert.equal(result.level, 'High');
  assert.equal(result.recommendedAction, 'DENY_OR_ADMIN_REVIEW');
  assert.equal(result.decision, 'DENY');
});

test('blocked device is always denied and classified as critical', () => {
  const result = assessLoginRisk({
    device: { ...knownDevice, status: 'Blocked' },
    ipAddress: '203.0.113.10',
    userAgent: 'SecureGate Test Browser',
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, 'Critical');
  assert.equal(result.recommendedAction, 'DENY_AND_ALERT');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['device_blocked']);
});

test('revoked device is always denied and classified as critical', () => {
  const result = assessLoginRisk({ device: { ...knownDevice, status: 'Revoked' } });
  assert.equal(result.score, 100);
  assert.equal(result.level, 'Critical');
  assert.equal(result.recommendedAction, 'DENY_AND_ALERT');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['device_revoked_reenrollment_denied']);
});

test('new device and maximum OTP-attempt risk produce 75-point high assessment', () => {
  const result = assessLoginRisk({ device: null, otpAttempts: 100 });
  assert.equal(result.score, 75);
  assert.equal(result.level, 'High');
  assert.equal(result.recommendedAction, 'DENY_OR_ADMIN_REVIEW');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['new_device', 'incorrect_otp_attempts']);
});
