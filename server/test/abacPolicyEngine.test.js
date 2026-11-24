import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAbac, matchesCondition, ABAC_ATTRIBUTES } from '../src/services/abacPolicyEngine.js';

const subject = { role: 'Employee', department: 'Engineering', status: 'Active' };
const device = { trustScore: 85, status: 'Trusted', platform: 'Windows' };

test('permits when all conditions match', () => {
  const result = evaluateAbac({ subject, device, action: 'documents:read', resourceType: 'Document', policies: [
    { effect: 'PERMIT', actions: ['documents:read'], resourceTypes: ['Document'], conditions: [
      { attribute: 'subject.department', operator: 'eq', value: 'Engineering' },
      { attribute: 'device.trustScore', operator: 'gte', value: 70 }
    ] }
  ] });
  assert.equal(result.decision, 'PERMIT');
});

test('deny overrides permit regardless of priority', () => {
  const result = evaluateAbac({ subject, device, action: 'documents:read', resourceType: 'Document', policies: [
    { effect: 'PERMIT', priority: 1000, actions: ['*'], resourceTypes: ['*'], conditions: [] },
    { effect: 'DENY', priority: 1, actions: ['documents:read'], resourceTypes: ['Document'], conditions: [] }
  ] });
  assert.equal(result.decision, 'DENY');
});

test('returns not applicable when no policy matches', () => {
  const result = evaluateAbac({ subject, device, action: 'users:delete', resourceType: 'User', policies: [] });
  assert.equal(result.decision, 'NOT_APPLICABLE');
});

test('does not match a condition when the attribute is missing', () => {
  assert.equal(matchesCondition({ attribute: 'device.trustScore', operator: 'gte', value: 50 }, { subject, device: {} }), false);
});

test('rejects unknown attribute paths by failing closed', () => {
  assert.equal(matchesCondition({ attribute: 'subject.password', operator: 'eq', value: 'x' }, { subject }), false);
  assert.equal(ABAC_ATTRIBUTES.includes('subject.password'), false);
});

test('supports wildcard actions and resource types', () => {
  const result = evaluateAbac({ subject, device, action: 'reports:read', resourceType: 'Report', policies: [
    { effect: 'PERMIT', actions: ['*'], resourceTypes: ['*'], conditions: [] }
  ] });
  assert.equal(result.decision, 'PERMIT');
});

test('disabled policies are ignored', () => {
  const result = evaluateAbac({ subject, device, action: 'documents:read', resourceType: 'Document', policies: [
    { enabled: false, effect: 'DENY', actions: ['*'], resourceTypes: ['*'], conditions: [] }
  ] });
  assert.equal(result.decision, 'NOT_APPLICABLE');
});

test('numeric comparisons reject string coercion', () => {
  assert.equal(matchesCondition({ attribute: 'device.trustScore', operator: 'gte', value: 50 }, { device: { trustScore: '90' } }), false);
});
