import React from 'react';
import {
  DEFAULT_SCHEDULES,
  INTERVAL_OPTIONS,
  JobConfig,
  JobKey,
  ScheduleFormState,
  ScheduleMode,
  WEEKDAY_OPTIONS,
} from './jobTypes';
import { buildCronFromSchedule, describeSchedule, parseCronToSchedule } from './jobUtils';

export function JobScheduleEditor({
  accentClass,
  config,
  jobKey,
  onUpdate,
}: {
  accentClass: string;
  config: JobConfig;
  jobKey: JobKey;
  onUpdate: (field: string, value: any) => void;
}) {
  const schedule = parseCronToSchedule(config.cron, DEFAULT_SCHEDULES[jobKey]);

  const updateSchedule = (patch: Partial<ScheduleFormState>) => {
    const nextSchedule = { ...schedule, ...patch };
    onUpdate('cron', buildCronFromSchedule(nextSchedule));
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Schedule Type
        </label>
        <select
          value={schedule.mode}
          onChange={(e) => updateSchedule({ mode: e.target.value as ScheduleMode })}
          className={`w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 ${accentClass}`}
        >
          <option value="hourly">Every few hours</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>

      {schedule.mode === 'hourly' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Repeat Every
          </label>
          <select
            value={schedule.intervalHours}
            onChange={(e) => updateSchedule({ intervalHours: e.target.value })}
            className={`w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 ${accentClass}`}
          >
            {INTERVAL_OPTIONS.map((hours) => (
              <option key={hours} value={hours}>
                {hours} hour{hours === '1' ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {schedule.mode === 'weekly' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Day of Week
          </label>
          <select
            value={schedule.dayOfWeek}
            onChange={(e) => updateSchedule({ dayOfWeek: e.target.value })}
            className={`w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 ${accentClass}`}
          >
            {WEEKDAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {schedule.mode !== 'hourly' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Run Time
          </label>
          <input
            type="time"
            value={schedule.time}
            onChange={(e) => updateSchedule({ time: e.target.value })}
            className={`w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 ${accentClass}`}
          />
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
        <div>{describeSchedule(schedule)}</div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">{config.cron}</div>
      </div>
    </div>
  );
}
