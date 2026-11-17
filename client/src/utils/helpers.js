export const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
};

export const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const d = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(dateString);
};

export const getInitials = (firstName = '', lastName = '') => {
  const f = firstName ? firstName[0].toUpperCase() : '';
  const l = lastName ? lastName[0].toUpperCase() : '';
  return f + l || 'SG';
};

export const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'Active':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'Suspended':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'Deactivated':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    default:
      return 'bg-slate-800 text-slate-300 border border-slate-700';
  }
};

export const getRoleBadgeClass = (roleName) => {
  switch (roleName) {
    case 'Super Admin':
      return 'bg-violet-500/15 text-violet-300 border border-violet-500/30';
    case 'IT Administrator':
      return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
    case 'HR Manager':
      return 'bg-pink-500/15 text-pink-300 border border-pink-500/30';
    case 'Security Auditor':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    default:
      return 'bg-slate-700/30 text-slate-300 border border-slate-600/30';
  }
};

export const getAuditActionBadgeClass = (action = '', status = 'SUCCESS') => {
  if (status === 'FAILED') {
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  }

  if (action.includes('LOGIN')) {
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  }
  if (action.includes('ROLE') || action.includes('PERMISSION')) {
    return 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
  }
  if (action.includes('CREATE')) {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
  if (action.includes('DELETE')) {
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  }
  if (action.includes('UPDATE') || action.includes('STATUS')) {
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  }

  return 'bg-slate-800 text-slate-300 border border-slate-700';
};
