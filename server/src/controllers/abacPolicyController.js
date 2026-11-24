import AbacPolicy from '../models/AbacPolicy.js';
import { evaluateAbac, ABAC_ATTRIBUTES } from '../services/abacPolicyEngine.js';
import { validateAbacPolicyPayload } from '../services/abacPolicyValidation.js';
import { logAudit } from '../services/auditService.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export const listAbacPolicies = async (req, res) => {
  const policies = await AbacPolicy.find().sort({ priority: -1, createdAt: 1 }).lean();
  res.json({ success: true, count: policies.length, policies, supportedAttributes: ABAC_ATTRIBUTES });
};

export const createAbacPolicy = async (req, res) => {
  try {
    const payload = validateAbacPolicyPayload(req.body);
    const policy = await AbacPolicy.create({ ...payload, createdBy: req.user._id, updatedBy: req.user._id });
    await logAudit({ req, action: 'ABAC_POLICY_CREATED', category: 'SECURITY', targetType: 'System', targetId: policy._id, targetName: policy.name, details: { effect: policy.effect, actions: policy.actions, resourceTypes: policy.resourceTypes } });
    res.status(201).json({ success: true, policy });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({ success: false, message: error.message });
  }
};

export const updateAbacPolicy = async (req, res) => {
  try {
    const payload = validateAbacPolicyPayload(req.body);
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
