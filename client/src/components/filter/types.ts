import type { ChangeEventHandler, ReactNode } from 'react';

export interface FilterSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
}

export interface FilterInputProps {
  label: string;
  enabled: boolean;
  onToggle: ChangeEventHandler<HTMLInputElement>;
  children: ReactNode;
  compact?: boolean;
}
