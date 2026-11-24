import AbacPolicy from '../models/AbacPolicy.js';
import { evaluateAbac } from '../services/abacPolicyEngine.js';

// ABAC is an additional policy gate: it may deny an RBAC-authorized request,
// but it never grants a request that RBAC has not already authorized.
export const requireAbac = (action, resourceType, getResource = () => ({})) => async (req, res, next) => {
  try {
    const policies = await AbacPolicy.find({ enabled: true }).lean();
    // Resource attributes may require an authoritative database lookup. Await the
    // resolver so callers cannot accidentally pass an unresolved Promise as context.
    const resourceAttributes = await getResource(req);
    const result = evaluateAbac({
      policies,
      subject: {
        role: req.user?.role?.name,
        department: req.user?.department,
        status: req.user?.status
      },
      device: {
        trustScore: req.device?.trustScore,
        status: req.device?.status,
        platform: req.device?.platform
      },
      resource: { type: resourceType, ...(resourceAttributes || {}) },
      context: {
        riskScore: req.device?.lastRiskScore,
        ipAddress: req.ip
      },
      action,
      resourceType
    });

    req.abacDecision = result;
    if (result.decision === 'DENY') {
      return res.status(403).json({
        success: false,
        message: 'Access denied by organization ABAC policy.',
        authorization: { model: 'RBAC+ABAC', decision: 'DENY', policyId: result.policyId }
      });
    }
    return next();
  } catch (error) {
    console.error('[ABAC POLICY EVALUATION FAILURE]:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Access temporarily unavailable because policy evaluation could not be completed.'
    });
  }
};
