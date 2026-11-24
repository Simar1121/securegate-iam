import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceController } from '../src/controllers/deviceController.js';

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeController = ({ device = null, valid = true } = {}) => {
  const calls = { findOne: [], saves: 0, audits: 0, auditPayload: null, errors: [] };
  const DeviceModel = {
    findOne: async (filter) => {
      calls.findOne.push(filter);
      return device;
    },
  };
  const controller = createDeviceController({
    DeviceModel,
    isValidObjectId: () => valid,
    writeAudit: async (payload) => {
      calls.audits += 1;
      calls.auditPayload = payload;
    },
    logger: { error: (...args) => calls.errors.push(args) },
    now: () => new Date('2026-11-24T06:30:00.000Z'),
  });
  return { ...controller, calls };
};

const request = (id = 'device-id') => ({
  params: { id },
  user: { _id: 'user-1', email: 'user@example.test', fullName: 'Test User', role: { name: 'Employee' } },
});

test('rejects an invalid device ID with 400 without querying or mutating', async () => {
  const { revokeMyDevice, calls } = makeController({ valid: false });
  const res = makeResponse();

  await revokeMyDevice(request('invalid'), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.findOne.length, 0);
  assert.equal(calls.saves, 0);
  assert.equal(calls.audits, 0);
});

test('returns 404 for a foreign or missing device without mutation', async () => {
  const { revokeMyDevice, calls } = makeController({ device: null });
  const res = makeResponse();

  await revokeMyDevice(request(), res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(calls.findOne[0], { _id: 'device-id', userId: 'user-1' });
  assert.equal(calls.saves, 0);
  assert.equal(calls.audits, 0);
});

test('returns success for an already-revoked device without saving or auditing again', async () => {
  const device = { status: 'Revoked', save: async () => { throw new Error('must not save'); } };
  const { revokeMyDevice, calls } = makeController({ device });
  const res = makeResponse();

  await revokeMyDevice(request(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /already been revoked/i);
  assert.equal(calls.audits, 0);
});

test('revokes an owned device, resets trust, saves, and writes an audit event', async () => {
  const device = {
    _id: 'device-id',
    deviceName: 'My laptop',
    status: 'Trusted',
    trustScore: 85,
    revokedAt: null,
    save: async () => { device.saved = true; },
  };
  const { revokeMyDevice, calls } = makeController({ device });
  const res = makeResponse();

  await revokeMyDevice(request(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(device.status, 'Revoked');
  assert.equal(device.trustScore, 0);
  assert.equal(device.revokedAt.toISOString(), '2026-11-24T06:30:00.000Z');
  assert.equal(device.saved, true);
  assert.equal(calls.audits, 1);
  assert.equal(calls.auditPayload.action, 'DEVICE_REVOKED');
  assert.equal(calls.auditPayload.targetId, 'device-id');
  assert.deepEqual(calls.auditPayload.details, { sessionsInvalidated: true });
});

test('returns 500 and does not audit when the device save fails', async () => {
  const device = {
    status: 'Trusted',
    trustScore: 40,
    save: async () => { throw new Error('database unavailable'); },
  };
  const { revokeMyDevice, calls } = makeController({ device });
  const res = makeResponse();

  await revokeMyDevice(request(), res);

  assert.equal(res.statusCode, 500);
  assert.equal(calls.audits, 0);
  assert.equal(calls.errors.length, 1);
});
