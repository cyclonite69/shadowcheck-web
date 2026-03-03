/**
 * Threat Score v4.0 Breakdown Component
 * Displays individual component scores and fleet correlation bonus
 */

import React from 'react';

interface ThreatScoreComponents {
  following_pattern: number;
  parked_surveillance: number;
  location_correlation: number;
  equipment_profile: number;
  temporal_persistence: number;
  fleet_correlation_bonus: number;
}

interface ThreatScoreBreakdownProps {
  totalScore: number;
  threatLevel: string;
  components: ThreatScoreComponents;
  modelVersion: string;
}

export const ThreatScoreBreakdown: React.FC<ThreatScoreBreakdownProps> = ({
  totalScore,
  threatLevel,
  components,
  modelVersion,
}) => {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-600';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const componentData = [
    {
      name: 'Following Pattern',
      score: components.following_pattern,
      max: 35,
      color: 'bg-purple-500',
    },
    {
      name: 'Parked Surveillance',
      score: components.parked_surveillance,
      max: 20,
      color: 'bg-red-500',
    },
    {
      name: 'Location Correlation',
      score: components.location_correlation,
      max: 15,
      color: 'bg-orange-500',
    },
    {
      name: 'Equipment Profile',
      score: components.equipment_profile,
      max: 10,
      color: 'bg-yellow-500',
    },
    {
      name: 'Temporal Persistence',
      score: components.temporal_persistence,
      max: 5,
      color: 'bg-blue-500',
    },
  ];

  const hasFleetBonus = components.fleet_correlation_bonus > 0;

  return (
    <div className="threat-score-breakdown p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Threat Score: {totalScore.toFixed(1)}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">Model v{modelVersion}</span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-white font-semibold ${getThreatColor(threatLevel)}`}
        >
          {threatLevel}
        </span>
      </div>

      {/* Component Breakdown */}
      <div className="space-y-3">
        {componentData.map((component) => (
          <div key={component.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300">{component.name}</span>
              <span className="text-gray-600 dark:text-gray-400">
                {component.score.toFixed(1)} / {component.max}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`${component.color} h-2 rounded-full transition-all duration-300`}
                style={{ width: `${(component.score / component.max) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {/* Fleet Correlation Bonus */}
        {hasFleetBonus && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="font-semibold text-red-900 dark:text-red-100">
                  Fleet Operation Detected
                </span>
              </div>
              <span className="text-red-700 dark:text-red-300 font-bold">
                +{components.fleet_correlation_bonus.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
              This network is part of a coordinated surveillance fleet
            </p>
          </div>
        )}
      </div>

      {/* Individual Score Total */}
      <div className="mt-4 pt-3 border-t border-gray-300 dark:border-gray-600">
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-gray-700 dark:text-gray-300">Individual Behavior Score</span>
          <span className="text-gray-900 dark:text-gray-100">
            {(totalScore - components.fleet_correlation_bonus).toFixed(1)} / 85
          </span>
        </div>
      </div>
    </div>
  );
};
