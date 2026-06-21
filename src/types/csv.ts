export interface CSVSurgeonRow {
  name: string;
  type: string;
  ocd_blackouts: string;
  ocn_blackouts: string;
  both_blackouts: string;
  robot_blocks: string;
  shift_preference?: string;  // "24H" | "12H" | "none"
  custom_preferences?: string;
  available_dates?: string;   // POOL only: pipe-separated ISO dates (up to 6)
}
