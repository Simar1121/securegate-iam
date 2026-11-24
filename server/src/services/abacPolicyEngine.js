const ATTRIBUTE_PATHS = new Set([
  'subject.role', 'subject.department', 'subject.status',
  'device.trustScore', 'device.status', 'device.platform',
  'resource.ownerId', 'resource.department', 'resource.type',
  'context.riskScore', 'context.ipAddress'
]);

const getValue = (object, path) => path.split('.').reduce(
  (value, key) => value == null ? undefined : value[key], object
);

const compare = (actual, operator, expected) => {
  if (actual === undefined || actual === null) return false;
  switch (operator) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
    case 'contains': return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'gt': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default: return false;
  }
};

export const matchesCondition = (condition, attributes) => {
  if (!condition || !ATTRIBUTE_PATHS.has(condition.attribute)) return false;
  return compare(getValue(attributes, condition.attribute), condition.operator, condition.value);
};

export const evaluateAbac = ({ policies = [], subject, device, resource = {}, context = {}, action, resourceType }) => {
  const attributes = { subject: subject || {}, device: device || {}, resource: resource || {}, context: context || {} };
  const applicable = policies
    .filter(policy => policy.enabled !== false &&
      (policy.actions || []).some(value => value === action || value === '*') &&
      (policy.resourceTypes || []).some(value => value === resourceType || value === '*') &&
      (policy.conditions || []).every(condition => matchesCondition(condition, attributes)))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const deny = applicable.find(policy => policy.effect === 'DENY');
  if (deny) return { decision: 'DENY', reason: 'A matching deny policy takes precedence.', policyId: String(deny._id || deny.id || '') };
  const permit = applicable.find(policy => policy.effect === 'PERMIT');
  if (permit) return { decision: 'PERMIT', reason: 'A matching permit policy applies.', policyId: String(permit._id || permit.id || '') };
  return { decision: 'NOT_APPLICABLE', reason: 'No enabled ABAC policy matched; existing RBAC authorization remains authoritative.', policyId: null };
};

export const ABAC_ATTRIBUTES = [...ATTRIBUTE_PATHS];
