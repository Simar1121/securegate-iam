import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLoginRisk } from '../src/services/riskEngine.js';

const knownDevice = {
  status: 'Trusted',
  lastIpAddress: '203.0.113.10',
  userAgent: 'SecureGate Test Browser',
};

test('known trusted device with stable context is low risk and allowed', () => {
  assert.deepEqual(assessLoginRisk({
    device: knownDevice,
    ipAddress: '203.0.113.10',
    userAgent: 'SecureGate Test Browser',
  }), {
    score: 0,
    level: 'Low',
    decision: 'ALLOW',
    reasons: ['known_device_and_stable_context'],
  });
});

test('new device adds 35 points and is medium risk', () => {
  const result = assessLoginRisk({ device: null });
  assert.equal(result.score, 35);
  assert.equal(result.level, 'Medium');
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
  assert.equal(result.level, 'Medium');
  assert.deepEqual(result.reasons, ['ip_address_changed', 'user_agent_changed']);
});

test('OTP attempt risk is capped at 40 points', () => {
  const result = assessLoginRisk({ device: knownDevice, otpAttempts: 99 });
  assert.equal(result.score, 40);
  assert.equal(result.level, 'Medium');
  assert.equal(result.decision, 'ALLOW');
  assert.deepEqual(result.reasons, ['incorrect_otp_attempts']);
});

test('risk score of 70 is high and denied', () => {
  const result = assessLoginRisk({
    device: knownDevice,
    ipAddress: '198.51.100.22',
    userAgent: 'Different Browser',
    otpAttempts: 4,
  });
  assert.equal(result.score, 70);
  assert.equal(result.level, 'High');
  assert.equal(result.decision, 'DENY');
});

test('blocked device is always denied regardless of other context', () => {
  const result = assessLoginRisk({
    device: { ...knownDevice, status: 'Blocked' },
    ipAddress: '203.0.113.10',
    userAgent: 'SecureGate Test Browser',
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, 'High');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['device_blocked']);
});

test('revoked device is always denied regardless of other context', () => {
  const result = assessLoginRisk({ device: { ...knownDevice, status: 'Revoked' } });
  assert.equal(result.score, 100);
  assert.equal(result.level, 'High');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['device_revoked_reenrollment_denied']);
});

test('new device and maximum OTP-attempt risk produce 75 points', () => {
  const result = assessLoginRisk({ device: null, otpAttempts: 100 });
  assert.equal(result.score, 75);
  assert.equal(result.level, 'High');
  assert.equal(result.decision, 'DENY');
  assert.deepEqual(result.reasons, ['new_device', 'incorrect_otp_attempts']);
});
