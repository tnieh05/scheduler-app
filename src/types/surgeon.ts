export type SurgeonType = 'EGS' | 'NON_EGS' | 'POOL';

export interface BlackoutDate {
  date: string; // ISO "YYYY-MM-DD"
  type: 'OCD' | 'OCN' | 'BOTH';
}

export interface RobotBlock {
  date: string;
  assistingOnly: boolean;
}

export interface SurgeonPreferences {
  shiftPreference: 'none' | '24H' | '12H' | '24H_ONLY' | '12H_ONLY';
  customNotes: string;
}

export const defaultPreferences: SurgeonPreferences = {
  shiftPreference: 'none',
  customNotes: '',
};

export interface Surgeon {
  id: string;
  name: string;
  type: SurgeonType;
  blackouts: BlackoutDate[];
  robotBlocks: RobotBlock[];
  preferences: SurgeonPreferences;
  /** POOL surgeons only: up to 6 ISO dates on which they will work a 24H shift. */
  availableDates?: string[];
}
