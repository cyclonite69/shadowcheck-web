import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { BrainIcon } from './ConfigIcons';
import { ConfigFlagRow, type FlagItem } from './ConfigFlagRow';

interface ScoringControlsConfigProps {
  featureFlags: any;
  isLoading: boolean;
  updateFeatureFlag: (key: string, next: boolean) => void;
}

export const ScoringControlsConfig: React.FC<ScoringControlsConfigProps> = ({
  featureFlags,
  isLoading,
  updateFeatureFlag,
}) => {
  const mlScoringOn = featureFlags?.adminAllowMlScoring ?? true;
  const simpleRuleOn = featureFlags?.simpleRuleScoringEnabled ?? false;

  let scoringMode: { label: string; className: string };
  if (mlScoringOn) {
    scoringMode = {
      label: 'Mode: ML Scoring',
      className: 'border-cyan-700/50 bg-cyan-900/20 text-cyan-300',
    };
  } else if (simpleRuleOn) {
    scoringMode = {
      label: 'Mode: Pure Rule Scoring',
      className: 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300',
    };
  } else {
    scoringMode = {
      label: 'Mode: None (no scoring active)',
      className: 'border-amber-700/50 bg-amber-900/20 text-amber-300',
    };
  }

  const scoringFlags: FlagItem[] = [
    {
      label: 'ML Training',
      enabled: featureFlags?.adminAllowMlTraining ?? true,
      detail: 'admin_allow_ml_training',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'ML Scoring',
      enabled: featureFlags?.adminAllowMlScoring ?? true,
      detail: 'admin_allow_ml_scoring',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Simple Rule Scoring',
      enabled: featureFlags?.simpleRuleScoringEnabled ?? false,
      detail: 'simple_rule_scoring_enabled',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Score Debug Logging',
      enabled: featureFlags?.scoreDebugLogging ?? false,
      detail: 'score_debug_logging',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Auto-Geocode on Import',
      enabled: featureFlags?.autoGeocodeOnImport ?? true,
      detail: 'auto_geocode_on_import',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
    {
      label: 'Deduplicate on Scan Ingest',
      enabled: featureFlags?.dedupeOnScan ?? true,
      detail: 'dedupe_on_scan',
      source: 'Database setting',
      impact: 'Live',
      editable: true,
    },
  ];

  return (
    <AdminCard icon={BrainIcon} title="Scoring Controls" color="from-indigo-500 to-violet-600">
      <div className="space-y-4">
        <div
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${scoringMode.className}`}
        >
          {scoringMode.label}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scoringFlags.map((item) => (
            <ConfigFlagRow
              key={item.label}
              item={item}
              isLoading={isLoading}
              onToggle={updateFeatureFlag}
            />
          ))}
        </div>
      </div>
    </AdminCard>
  );
};
