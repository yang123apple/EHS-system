// src/app/hidden-danger/_components/Badges.tsx
import { STATUS_MAP, RISK_LEVEL_MAP } from '@/constants/hazard';
import { HazardStatus, RiskLevel } from '@/types/hidden-danger';

export function StatusBadge({ status }: { status: HazardStatus }) {
  const s = STATUS_MAP[status] || STATUS_MAP['reported'];
  return (
    <span className={`px-2 py-0.5 rounded text-xs border whitespace-nowrap ${s.color}`}>
      {s.text}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const r = RISK_LEVEL_MAP[level] || RISK_LEVEL_MAP['low'];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${r.bg} ${r.color}`}>
      {r.label}
    </span>
  );
}
