import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Plus, Play, RefreshCw, Trash2, Power, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const ATTRIBUTES = [
  'subject.role', 'subject.department', 'subject.status',
  'device.trustScore', 'device.status', 'device.platform',
  'resource.ownerId', 'resource.department', 'resource.type',
  'context.riskScore', 'context.ipAddress',
];
const OPERATORS = ['eq', 'neq', 'in', 'not_in', 'contains', 'gt', 'gte', 'lt', 'lte'];
const blankCondition = () => ({ attribute: 'context.riskScore', operator: 'gte', value: '70' });
const blankPolicy = () => ({
  name: '', description: '', effect: 'DENY', actions: 'users:read',
  resourceTypes: 'User', priority: 100, enabled: true, conditions: [blankCondition()],
});

export const AbacPolicies = () => {
  const toast = useToast();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankPolicy);
  const [editingId, setEditingId] = useState(null);
  const [sim, setSim] = useState({
    action: 'users:read', resourceType: 'User',
    subject: '{"role":"Employee","department":"Engineering","status":"Active"}',
    device: '{"trustScore":35,"status":"Active","platform":"Windows"}',
    resource: '{"department":"Engineering","type":"User"}',
    context: '{"riskScore":75,"ipAddress":"203.0.113.10"}',
  });
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/abac-policies');
      setPolicies(data.policies || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not load ABAC policies.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const resetForm = () => { setForm(blankPolicy()); setEditingId(null); };

  const startEdit = (policy) => {
    setEditingId(policy._id);
    setForm({
      name: policy.name || '', description: policy.description || '',
      effect: policy.effect, actions: (policy.actions || []).join(', '),
      resourceTypes: (policy.resourceTypes || []).join(', '),
      priority: policy.priority ?? 100, enabled: policy.enabled !== false,
      conditions: (policy.conditions || []).map(c => ({ ...c, value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value) })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    const conditions = form.conditions.map(c => {
      const arrayValue = ['in', 'not_in'].includes(c.operator);
      let value = arrayValue ? c.value.split(',').map(v => v.trim()).filter(Boolean) : c.value.trim();
      if (!arrayValue && ['gt', 'gte', 'lt', 'lte'].includes(c.operator)) value = Number(value);
      if (!arrayValue && ['eq', 'neq'].includes(c.operator) && ['device.trustScore', 'context.riskScore'].includes(c.attribute)) value = Number(value);
      return { attribute: c.attribute, operator: c.operator, value };
    });
    const payload = {
      name: form.name.trim(), description: form.description.trim(), effect: form.effect,
      actions: form.actions.split(',').map(v => v.trim()).filter(Boolean),
      resourceTypes: form.resourceTypes.split(',').map(v => v.trim()).filter(Boolean),
      priority: Number(form.priority), enabled: form.enabled, conditions,
    };
    try {
      setSaving(true);
      if (editingId) await api.put('/abac-policies/' + editingId, payload);
      else await api.post('/abac-policies', payload);
      toast.success(editingId ? 'ABAC policy updated.' : 'ABAC policy created.');
      resetForm();
      await loadPolicies();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save ABAC policy.');
    } finally { setSaving(false); }
  };

  const togglePolicy = async (policy) => {
    try {
      await api.put('/abac-policies/' + policy._id, {
        name: policy.name, description: policy.description, effect: policy.effect,
        actions: policy.actions, resourceTypes: policy.resourceTypes,
        conditions: policy.conditions, priority: policy.priority, enabled: !policy.enabled,
      });
      toast.success('Policy status updated.');
      loadPolicies();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update policy.'); }
  };

  const deletePolicy = async (policy) => {
    if (!window.confirm('Delete ABAC policy "' + policy.name + '"?')) return;
    try {
      await api.delete('/abac-policies/' + policy._id);
      toast.success('Policy deleted.');
      loadPolicies();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to delete policy.'); }
  };

  const runSimulation = async (event) => {
    event.preventDefault();
    try {
      setSimulating(true);
      const payload = {
        action: sim.action, resourceType: sim.resourceType,
        subject: JSON.parse(sim.subject), device: JSON.parse(sim.device),
        resource: JSON.parse(sim.resource), context: JSON.parse(sim.context),
      };
      const { data } = await api.post('/abac-policies/simulate', payload);
      setSimulation(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Simulation failed. Check that each attribute field contains valid JSON.');
      setSimulation(null);
    } finally { setSimulating(false); }
  };

  const inputClass = 'w-full mt-1 rounded-lg bg-charcoal-950 border border-charcoal-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-400';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">ABAC Policy Management</h1>
          <p className="mt-1 text-sm text-slate-400">Attribute-Based Access Control · Context-aware policy governance and simulation</p>
        </div>
        <button onClick={loadPolicies} className="inline-flex items-center gap-2 rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-slate-200">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      <section className="rounded-2xl border border-charcoal-800 bg-charcoal-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">{editingId ? 'Edit ABAC Policy' : 'Create ABAC Policy'}</h2>
        </div>
        <form onSubmit={savePolicy} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Policy name
              <input className={inputClass} value={form.name} onChange={e => setForm({...form, name:e.target.value})} minLength={3} maxLength={100} required placeholder="Block high-risk access" />
            </label>
            <label className={labelClass}>Effect
              <select className={inputClass} value={form.effect} onChange={e => setForm({...form, effect:e.target.value})}>
                <option value="DENY">DENY</option><option value="PERMIT">PERMIT</option>
              </select>
            </label>
            <label className={labelClass}>Actions (comma separated)
              <input className={inputClass} value={form.actions} onChange={e => setForm({...form, actions:e.target.value})} required placeholder="users:read, users:update or *" />
            </label>
            <label className={labelClass}>Resource types (comma separated)
              <input className={inputClass} value={form.resourceTypes} onChange={e => setForm({...form, resourceTypes:e.target.value})} required placeholder="User or *" />
            </label>
            <label className={labelClass}>Priority (0–1000)
              <input className={inputClass} type="number" min="0" max="1000" value={form.priority} onChange={e => setForm({...form,priority:e.target.value})} required />
            </label>
            <label className={labelClass}>Description
              <input className={inputClass} value={form.description} onChange={e => setForm({...form,description:e.target.value})} maxLength={500} placeholder="Explain why this policy exists" />
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-white">Conditions (all must match)</h3>
              <button type="button" onClick={() => setForm({...form,conditions:[...form.conditions,blankCondition()]})} className="text-xs font-semibold text-violet-300">+ Add condition</button>
            </div>
            {form.conditions.map((condition,index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-charcoal-800 bg-charcoal-950 p-3 md:grid-cols-[1.3fr_0.8fr_1fr_auto]">
                <select className={inputClass} value={condition.attribute} onChange={e => setForm({...form,conditions:form.conditions.map((c,i)=>i===index?{...c,attribute:e.target.value}:c)})}>
                  {ATTRIBUTES.map(a=><option key={a}>{a}</option>)}
                </select>
                <select className={inputClass} value={condition.operator} onChange={e => setForm({...form,conditions:form.conditions.map((c,i)=>i===index?{...c,operator:e.target.value}:c)})}>
                  {OPERATORS.map(op=><option key={op} value={op}>{op}</option>)}
                </select>
                <input className={inputClass} value={condition.value} onChange={e=>setForm({...form,conditions:form.conditions.map((c,i)=>i===index?{...c,value:e.target.value}:c)})} placeholder="Value (comma separated for in/not_in)" required />
                <button type="button" disabled={form.conditions.length===1} onClick={()=>setForm({...form,conditions:form.conditions.filter((_,i)=>i!==index)})} className="rounded-lg px-3 text-rose-400 disabled:opacity-30">Remove</button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})} /> Policy enabled</label>
          <div className="flex flex-wrap justify-end gap-2">
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-slate-300">Cancel edit</button>}
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? 'Saving…' : editingId ? 'Update Policy' : 'Create Policy'}</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-charcoal-800 bg-charcoal-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-white">Configured Policies <span className="text-sm font-normal text-slate-400">({policies.length})</span></h2>
        {loading ? <p className="text-sm text-slate-400">Loading policies…</p> : policies.length===0 ? <p className="rounded-lg border border-dashed border-charcoal-700 p-6 text-center text-sm text-slate-400">No ABAC policies yet. Create one above to begin evaluating contextual access rules.</p> :
          <div className="space-y-3">{policies.map(policy=><article key={policy._id} className="rounded-xl border border-charcoal-800 bg-charcoal-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{policy.name}</h3><span className={'rounded-full px-2 py-0.5 text-xs font-bold '+(policy.effect==='DENY'?'bg-rose-500/10 text-rose-300':'bg-emerald-500/10 text-emerald-300')}>{policy.effect}</span><span className="rounded-full bg-charcoal-800 px-2 py-0.5 text-xs text-slate-300">{policy.enabled?'Enabled':'Disabled'}</span></div><p className="mt-1 text-sm text-slate-400">{policy.description}</p></div>
            <div className="flex gap-2"><button onClick={()=>startEdit(policy)} className="rounded-lg border border-charcoal-700 px-3 py-1.5 text-xs text-slate-200">Edit</button><button onClick={()=>togglePolicy(policy)} className="rounded-lg border border-charcoal-700 p-2 text-amber-300" title="Toggle enabled"><Power className="h-4 w-4"/></button><button onClick={()=>deletePolicy(policy)} className="rounded-lg border border-charcoal-700 p-2 text-rose-300" title="Delete"><Trash2 className="h-4 w-4"/></button></div></div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400"><span>Priority: {policy.priority}</span><span>· Actions: {(policy.actions||[]).join(', ')}</span><span>· Resources: {(policy.resourceTypes||[]).join(', ')}</span></div>
            <div className="mt-2 flex flex-wrap gap-2">{(policy.conditions||[]).map((c,i)=><code key={i} className="rounded bg-charcoal-800 px-2 py-1 text-xs text-violet-200">{c.attribute} {c.operator} {Array.isArray(c.value)?c.value.join(', '):String(c.value)}</code>)}</div>
          </article>)}</div>}
      </section>

      <section className="rounded-2xl border border-charcoal-800 bg-charcoal-900 p-5">
        <div className="mb-2 flex items-center gap-2"><Play className="h-5 w-5 text-violet-400"/><h2 className="text-lg font-bold text-white">ABAC Policy Simulator</h2></div>
        <p className="mb-4 text-sm text-slate-400">Simulation only: evaluates enabled policies against the supplied subject, device, resource and context. It does not change access or data.</p>
        <form onSubmit={runSimulation} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2"><label className={labelClass}>Action<input className={inputClass} value={sim.action} onChange={e=>setSim({...sim,action:e.target.value})} required/></label><label className={labelClass}>Resource type<input className={inputClass} value={sim.resourceType} onChange={e=>setSim({...sim,resourceType:e.target.value})} required/></label></div>
          <div className="grid gap-3 md:grid-cols-2">{['subject','device','resource','context'].map(k=><label key={k} className={labelClass}>{k} attributes (JSON)<textarea className={inputClass+' min-h-24 font-mono text-xs'} value={sim[k]} onChange={e=>setSim({...sim,[k]:e.target.value})}/></label>)}</div>
          <div className="flex justify-end"><button disabled={simulating} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play className="h-4 w-4"/>{simulating?'Evaluating…':'Run Simulation'}</button></div>
        </form>
        {simulation && <div className="mt-4 rounded-xl border border-charcoal-700 bg-charcoal-950 p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-300">Decision</span><strong className={'text-lg '+(simulation.result?.decision==='DENY'?'text-rose-300':simulation.result?.decision==='PERMIT'?'text-emerald-300':'text-amber-300')}>{simulation.result?.decision}</strong></div><p className="mt-1 text-sm text-slate-300">{simulation.result?.reason}</p><p className="mt-2 text-xs text-slate-500">Evaluated enabled policies: {simulation.evaluatedPolicyCount} · Policy ID: {simulation.result?.policyId || 'None'}</p><p className="mt-2 flex items-center gap-1 text-xs text-amber-300"><AlertTriangle className="h-3.5 w-3.5"/> NOT_APPLICABLE does not bypass existing RBAC authorization.</p></div>}
      </section>
    </div>
  );
};
