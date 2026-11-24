import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequireAbac } from '../src/middleware/abacMiddleware.js';
import { createOwnedDeviceAttributesResolver } from '../src/services/deviceAbacResource.js';

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeMiddleware = ({ decision = 'NOT_APPLICABLE', resolver = async () => ({}) } = {}) => {
  const calls = { evaluate: null, next: 0 };
  const PolicyModel = { find: () => ({ lean: async () => [{ id: 'policy-1' }] }) };
  const middleware = createRequireAbac({
    PolicyModel,
    evaluate: (input) => { calls.evaluate = input; return { decision, policyId: 'policy-1' }; },
  })('devices:revoke', 'Device', resolver);
  return { middleware, calls };
};

test('awaits the resource resolver and continues on NOT_APPLICABLE', async () => {
  const ownerId = 'user-123';
  const { middleware, calls } = makeMiddleware({ resolver: async () => {
    await Promise.resolve();
    return { ownerId };
  } });
  const req = { user: { _id: ownerId, role: { name: 'Employee' } }, params: { id: 'device-1' }, ip: '127.0.0.1' };
  const res = makeResponse();
  let nextCount = 0;
  await middleware(req, res, () => { nextCount += 1; });

  assert.equal(nextCount, 1);
  assert.equal(calls.evaluate.resource.ownerId, ownerId);
  assert.equal(calls.evaluate.resource.type, 'Device');
  assert.equal(calls.evaluate.action, 'devices:revoke');
  assert.equal(req.abacDecision.decision, 'NOT_APPLICABLE');
});

test('blocks a matching DENY policy with 403', async () => {
  const { middleware } = makeMiddleware({ decision: 'DENY' });
  const res = makeResponse();
  let nextCount = 0;
  await middleware({ user: {}, params: {}, ip: '127.0.0.1' }, res, () => { nextCount += 1; });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.authorization.decision, 'DENY');
  assert.equal(nextCount, 0);
});

test('fails closed with 503 when resource resolution or policy evaluation fails', async () => {
  const { middleware } = makeMiddleware({ resolver: async () => { throw new Error('database unavailable'); } });
  const res = makeResponse();
  let nextCount = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    await middleware({ user: {}, params: {}, ip: '127.0.0.1' }, res, () => { nextCount += 1; });
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 503);
  assert.equal(nextCount, 0);
});

test('resolves ownership only for a valid device ID owned by the authenticated user', async () => {
  const authenticatedUserId = 'user-1';
  const queried = [];
  const Device = {
    findOne: (filter) => {
      queried.push(filter);
      return {
        select: () => ({
          lean: async () => ({ userId: authenticatedUserId }),
        }),
      };
    },
  };
  const resolver = createOwnedDeviceAttributesResolver({
    Device,
    isValidObjectId: (value) => value === 'valid-device-id',
  });
  const result = await resolver({
    params: { id: 'valid-device-id', ownerId: 'attacker' },
    user: { _id: authenticatedUserId },
  });

  assert.deepEqual(result, { ownerId: authenticatedUserId });
  assert.deepEqual(queried[0], { _id: 'valid-device-id', userId: authenticatedUserId });
});

test('does not query MongoDB for invalid IDs', async () => {
  let queryCount = 0;
  const resolver = createOwnedDeviceAttributesResolver({
    Device: { findOne: () => { queryCount += 1; throw new Error('should not query'); } },
    isValidObjectId: () => false,
  });
  const result = await resolver({ params: { id: 'not-an-object-id' }, user: { _id: 'user-1' } });

  assert.deepEqual(result, {});
  assert.equal(queryCount, 0);
});

test('foreign or missing devices resolve without owner attributes', async () => {
  const resolver = createOwnedDeviceAttributesResolver({
    Device: { findOne: () => ({ select: () => ({ lean: async () => null }) }) },
    isValidObjectId: () => true,
  });
  const result = await resolver({ params: { id: 'valid-device-id' }, user: { _id: 'user-1' } });

  assert.deepEqual(result, {});
});
