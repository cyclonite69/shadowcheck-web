import { INTERVAL_OPTIONS, JobConfig, ScheduleFormState, WEEKDAY_OPTIONS } from './jobTypes';
import { formatShortDate } from '../../../utils/formatDate';

export function normalizeJobConfig(rawValue: unknown, fallback: JobConfig): JobConfig {
  let parsedValue = rawValue;
  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue);
    } catch {
      return { ...fallback };
    }
  }

  if (!parsedValue || typeof parsedValue !== 'object') {
    return { ...fallback };
  }

  const candidate = parsedValue as Record<string, unknown>;
  return {
    ...fallback,
    ...candidate,
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
    cron:
      typeof candidate.cron === 'string' && candidate.cron.trim() ? candidate.cron : fallback.cron,
  };
}

export function parseCronToSchedule(cron: string, fallback: ScheduleFormState): ScheduleFormState {
  const normalized = cron.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');
  if (parts.length !== 5) {
    return fallback;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (/^\*\/\d+$/.test(hour) && /^\d+$/.test(minute)) {
      const intervalHours = hour.slice(2);
      if (INTERVAL_OPTIONS.includes(intervalHours)) {
        return {
          mode: 'hourly',
          time: `${minute.padStart(2, '0')}:00`,
          intervalHours,
          dayOfWeek: fallback.dayOfWeek,
        };
      }
    }

    if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) {
      return {
        mode: 'daily',
        time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
        intervalHours: fallback.intervalHours,
        dayOfWeek: fallback.dayOfWeek,
      };
    }
  }

  if (dayOfMonth === '*' && month === '*' && /^\d+$/.test(dayOfWeek)) {
    if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) {
      return {
        mode: 'weekly',
        time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
        intervalHours: fallback.intervalHours,
        dayOfWeek,
      };
    }
  }

  return fallback;
}

export function buildCronFromSchedule(schedule: ScheduleFormState): string {
  const [hours, minutes] = schedule.time.split(':');
  const minute = /^\d{2}$/.test(minutes || '') ? minutes : '00';
  const hour = /^\d{2}$/.test(hours || '') ? hours : '00';

  if (schedule.mode === 'hourly') {
    return `${Number.parseInt(minute, 10)} */${schedule.intervalHours} * * *`;
  }

  if (schedule.mode === 'weekly') {
    return `${Number.parseInt(minute, 10)} ${Number.parseInt(hour, 10)} * * ${schedule.dayOfWeek}`;
  }

  return `${Number.parseInt(minute, 10)} ${Number.parseInt(hour, 10)} * * *`;
}

export function describeSchedule(schedule: ScheduleFormState): string {
  if (schedule.mode === 'hourly') {
    return `Runs every ${schedule.intervalHours} hour${schedule.intervalHours === '1' ? '' : 's'}`;
  }

  if (schedule.mode === 'weekly') {
    const day =
      WEEKDAY_OPTIONS.find((option) => option.value === schedule.dayOfWeek)?.label || 'day';
    return `Runs every ${day} at ${schedule.time}`;
  }

  return `Runs daily at ${schedule.time}`;
}

export function formatTimestamp(value?: string | null): string {
  return formatShortDate(value);
}

export function formatDuration(durationMs?: number | null): string {
  if (!durationMs || durationMs < 1000) return 'under 1s';
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
}
