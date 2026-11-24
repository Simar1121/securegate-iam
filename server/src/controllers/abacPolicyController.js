import AbacPolicy from '../models/AbacPolicy.js';
import { evaluateAbac, ABAC_ATTRIBUTES } from '../services/abacPolicyEngine.js';
import { logAudit } from '../services/auditService.js';

const policyFields = new Set(['name', 'description', 'effect', 'actions', 'resourceTypes', 'conditions', 'priority', 'enabled']);
const operators = new Set(['eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte']);
const numericAttributes = new Set(['device.trustScore', 'context.riskScore']);

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPrimitive = value => ['string', 'number', 'boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value));

const validateCondition = condition => {
  if (!isRecord(condition) || Object.keys(condition).some(key => !['attribute', 'operator', 'value'].includes(key))) {
    throw new Error('Each condition must contain only attribute, operator and value.');
  }
  const { attribute, operator, value } = condition;
  if (!ABAC_ATTRIBUTES.includes(attribute)) throw new Error('Policy contains an unsupported attribute.');
  if (!operators.has(operator)) throw new Error('Policy contains an unsupported operator.');
  if (value === undefined || value === null || isRecord(value)) throw new Error('Condition value must be a non-null primitive or primitive array.');
  if (['in', 'not_in'].includes(operator)) {
    if (!Array.isArray(value) || value.length === 0 || value.length > 50 || !value.every(isPrimitive)) {
      throw new Error('in/not_in operators require an array of 1–50 primitive values.');
    }
    return;
  }
  if (Array.isArray(value) || !isPrimitive(value)) throw new Error('This operator requires a single primitive value.');
  if (operator === 'contains' && typeof value !== 'string') throw new Error('contains requires a string value.');
  if (['gt', 'gte', 'lt', 'lte'].includes(operator) &&
      (!numericAttributes.has(attribute) || typeof value !== 'number')) {
    throw new Error('Numeric comparison operators require a numeric risk/trust attribute and number value.');
  }
  if (numericAttributes.has(attribute) && ['eq', 'neq'].includes(operator) && typeof value !== 'number') {
    throw new Error('Risk and trust score comparisons require a numeric value.');
  }
};

const validatePayload = body => {
  if (!isRecord(body)) throw new Error('Policy payload must be a JSON object.');
  const unknown = Object.keys(body).filter(field => !policyFields.has(field));
  if (unknown.length) throw new Error(`Unsupported policy field(s): ${unknown.join(', ')}.`);

  const payload = { ...body };
  if ('name' in payload && (typeof payload.name !== 'string' || payload.name.trim().length < 3 || payload.name.trim().length > 100)) {
    throw new Error('Policy name must be between 3 and 100 characters.');
  }
  if ('description' in payload && (typeof payload.description !== 'string' || payload.description.length > 500)) {
    throw new Error('Policy description must be a string of at most 500 characters.');
  }
  if ('effect' in payload && !['PERMIT', 'DENY'].includes(payload.effect)) {
    throw new Error('Policy effect must be PERMIT or DENY.');
  }
  for (const field of ['actions', 'resourceTypes']) {
    if (field in payload) {
      const max = field === 'actions' ? 30 : 20;
      if (!Array.isArray(payload[field]) || payload[field].length === 0 || payload[field].length > max ||
          !payload[field].every(value => typeof value === 'string' && value.length > 0 && value.length <= 80)) {
        throw new Error(`${field} must be a non-empty array of at most ${max} strings (maximum 80 characters each).`);
      }
    }
  }
  if ('conditions' in payload) {
    if (!Array.isArray(payload.conditions) || payload.conditions.length > 20) {
      throw new Error('conditions must be an array containing at most 20 entries.');
    }
    payload.conditions.forEach(validateCondition);
  }
  if ('priority' in payload && (!Number.isInteger(payload.priority) || payload.priority < 0 || payload.priority > 1000)) {
    throw new Error('priority must be an integer between 0 and 1000.');
  }
  if ('enabled' in payload && typeof payload.enabled !== 'boolean') {
    throw new Error('enabled must be a boolean.');
  }
  return payload;
};

export const listAbacPolicies = async (req, res) => {
  const policies = await AbacPolicy.find().sort({ priority: -1, createdAt: 1 }).lean();
  res.json({ success: true, count: policies.length, policies, supportedAttributes: ABAC_ATTRIBUTES });
};

export const createAbacPolicy = async (req, res) => {
  try {
    const payload = validatePayload(req.body);
    const policy = await AbacPolicy.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
    await logAudit({ req, action: 'ABAC_POLICY_CREATED', category: 'SECURITY', targetType: 'System', targetId: policy._id, targetName: policy.name, details: { effect: policy.effect, actions: policy.actions, resourceTypes: policy.resourceTypes } });
    res.status(201).json({ success: true, policy });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ success: false, message: error.message });
  }
};

export const updateAbacPolicy = async (req, res) => {
  try {
    const payload = validatePayload(req.body);
    const policy = await AbacPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: 'ABAC policy not found.' });
    Object.assign(policy, payload, { updatedBy: req.user._id, version: policy.version + 1 });
    await policy.save();
    await logAudit({ req, action: 'ABAC_POLICY_UPDATED', category: 'SECURITY', targetType: 'System', targetId: policy._id, targetName: policy.name, details: { version: policy.version } });
    res.json({ success: true, policy });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ success: false, message: error.message });
  }
};

export const deleteAbacPolicy = async (req, res) => {
  const policy = await AbacPolicy.findById(req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: 'ABAC policy not found.' });
  await policy.deleteOne();
  await logAudit({ req, action: 'ABAC_POLICY_DELETED', category: 'SECURITY', targetType: 'System', targetId: policy._id, targetName: policy.name });
  res.json({ success: true, message: 'ABAC policy deleted.' });
};

export const simulateAbacPolicy = async (req, res) => {
  try {
    const { subject = {}, device = {}, resource = {}, context = {}, action, resourceType } = req.body;
    if (typeof action !== 'string' || !action.trim() || typeof resourceType !== 'string' || !resourceType.trim()) {
      return res.status(400).json({ success: false, message: 'action and resourceType are required.' });
    }
    if (![subject, device, resource, context].every(isRecord)) {
      return res.status(400).json({ success: false, message: 'subject, device, resource and context must be JSON objects.' });
    }
    const policies = await AbacPolicy.find({ enabled: true }).lean();
    const result = evaluateAbac({ policies, subject, device, resource, context, action, resourceType });
    res.json({ success: true, result, evaluatedPolicyCount: policies.length, note: 'Simulation only; no access or data is changed.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
