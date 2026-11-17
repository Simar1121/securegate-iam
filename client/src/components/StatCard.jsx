import React from 'react';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  color = 'violet',
}) => {
  const colorMap = {
    violet: {
      iconBg: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
      borderGlow: 'hover:border-violet-500/30',
    },
    emerald: {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      borderGlow: 'hover:border-emerald-500/30',
    },
    amber: {
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      borderGlow: 'hover:border-amber-500/30',
    },
    cyan: {
      iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      borderGlow: 'hover:border-cyan-500/30',
    },
    rose: {
      iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      borderGlow: 'hover:border-rose-500/30',
    },
  };

  const currentTheme = colorMap[color] || colorMap.violet;

  return (
    <div
      className={`p-5 rounded-2xl bg-charcoal-900 border border-charcoal-800 transition duration-150 shadow-lg ${currentTheme.borderGlow}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          {title}
        </span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${currentTheme.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-2 text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
};
