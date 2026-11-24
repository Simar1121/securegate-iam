import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAbacPolicyPayload } from '../src/services/abacPolicyValidation.js';
const valid = { name: 'Engineering access guard', effect: 'DENY', actions: ['documents:read'], resourceTypes: ['Document'], conditions: [{ attribute: 'subject.department', operator: 'eq', value: 'Finance' }] };
test('accepts a valid policy', () => assert.deepEqual(validateAbacPolicyPayload(valid), valid));
test('rejects unknown top-level fields', () => assert.throws(() => validateAbacPolicyPayload({ ...valid, createdBy: 'attacker' }), /Unsupported policy field/));
test('rejects unsupported attribute paths and operators', () => {
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.password', operator: 'eq', value: 'x' }] }), /unsupported attribute/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.role', operator: 'regex', value: '.*' }] }), /unsupported operator/);
});
test('requires non-empty arrays for in/not_in', () => {
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.role', operator: 'in', value: 'Employee' }] }), /require an array/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.role', operator: 'in', value: [] }] }), /require an array/);
});
test('requires numeric attributes and values for range comparisons', () => {
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.role', operator: 'gt', value: 5 }] }), /Numeric comparison/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'device.trustScore', operator: 'gte', value: '70' }] }), /Numeric comparison/);
});
test('rejects malformed action/resource lists and priority', () => {
  assert.throws(() => validateAbacPolicyPayload({ ...valid, actions: [] }), /actions must be/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, resourceTypes: [''] }), /resourceTypes must be/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, priority: 1001 }), /priority must be/);
});
test('rejects non-object payloads and non-boolean enabled values', () => {
  assert.throws(() => validateAbacPolicyPayload(null), /JSON object/);
  assert.throws(() => validateAbacPolicyPayload({ ...valid, enabled: 'false' }), /enabled must be a boolean/);
});
test('rejects nested condition objects', () => assert.throws(() => validateAbacPolicyPayload({ ...valid, conditions: [{ attribute: 'subject.role', operator: 'eq', value: { $gt: '' } }] }), /primitive/));
