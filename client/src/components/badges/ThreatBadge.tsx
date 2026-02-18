import type { ThreatInfo, ThreatEvidence } from '../../types/network';
import { THREAT_LEVEL_CONFIG } from '../../constants/network';

interface ThreatBadgeProps {
  threat?: ThreatInfo | null;
  reasons?: string[];
  evidence?: ThreatEvidence[];
}

export const ThreatBadge = ({ threat, reasons, evidence }: ThreatBadgeProps) => {
  if (!threat || threat.level === 'NONE') return null;

  const levelConfig = THREAT_LEVEL_CONFIG[threat.level];
  const reasonsList = (reasons || []).join(', ') || 'None';
  const evidenceLines =
    evidence && evidence.length > 0
      ? evidence
          .map(
            (e) =>
              `${e.rule}: observed=${e.observedValue ?? 'n/a'} threshold=${e.threshold ?? 'n/a'}`
          )
          .join('\n')
      : 'No evidence';

  return (
    <span
      style={{
        background: levelConfig.bg,
        color: levelConfig.color,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '500',
        border: `1px solid ${levelConfig.color}40`,
        display: 'inline-block',
        cursor: 'help',
      }}
      title={`${threat.summary}\nScore: ${(threat.score * 100).toFixed(0)}%\nReasons: ${reasonsList}\n${evidenceLines}`}
    >
      {levelConfig.label}
    </span>
  );
};
