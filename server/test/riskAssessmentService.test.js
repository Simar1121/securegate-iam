import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiskAssessmentRecorder } from '../src/services/riskAssessmentService.js';

const user = { _id: 'user-1' };
const device = { _id: 'device-1' };
const makeStore = () => {
  const store = { events: [], alerts: [], incidents: [] };
  return {
    store,
    RiskEventModel: { create: async (doc) => { const value = { _id: 'event-1', ...doc }; store.events.push(value); return value; } },
    AlertModel: { create: async (doc) => { const value = { _id: 'alert-1', ...doc }; store.alerts.push(value); return value; } },
    IncidentModel: { create: async (doc) => { const value = { _id: 'incident-1', ...doc }; store.incidents.push(value); return value; } },
  };
};

const assessment = (level, score, recommendedAction) => ({
  score, level, recommendedAction,
  decision: level === 'Low' || level === 'Medium' ? 'ALLOW' : 'DENY',
  reasons: ['test_signal'],
});

test('records low and medium risk assessments without opening alerts', async () => {
  const f = makeStore();
  const record = createRiskAssessmentRecorder(f);
  await record({ user, device, risk: assessment('Low', 0, 'ALLOW') });
  await record({ user, device, risk: assessment('Medium', 35, 'REQUIRE_MFA') });
  assert.equal(f.store.events.length, 2);
  assert.equal(f.store.alerts.length, 0);
  assert.equal(f.store.incidents.length, 0);
});

test('high risk creates an open review alert and no incident', async () => {
  const f = makeStore();
  await createRiskAssessmentRecorder(f)({ user, device, risk: assessment('High', 70, 'DENY_OR_ADMIN_REVIEW') });
  assert.equal(f.store.events[0].level, 'High');
  assert.equal(f.store.alerts[0].status, 'Open');
  assert.equal(f.store.alerts[0].severity, 'High');
  assert.equal(f.store.incidents.length, 0);
});

test('critical risk creates an alert and linked incident', async () => {
  const f = makeStore();
  await createRiskAssessmentRecorder(f)({ user, device, risk: assessment('Critical', 100, 'DENY_AND_ALERT') });
  assert.equal(f.store.alerts[0].severity, 'Critical');
  assert.equal(f.store.incidents[0].alertId, 'alert-1');
  assert.equal(f.store.incidents[0].riskEventId, 'event-1');
});

test('persistence failure propagates so the caller can fail closed', async () => {
  const f = makeStore();
  f.RiskEventModel.create = async () => { throw new Error('risk store unavailable'); };
  await assert.rejects(
    createRiskAssessmentRecorder(f)({ user, device, risk: assessment('Critical', 100, 'DENY_AND_ALERT') }),
    /risk store unavailable/
  );
});
