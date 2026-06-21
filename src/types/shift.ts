export type ShiftKind = 'OCD' | 'OCN' | 'EGS' | '24H';

export type AncillaryKind = 'PRECALL_AM' | 'POSTCALL_PM' | 'POSTCALL_AM';

export interface Shift {
  id: string;
  surgeonId: string;
  date: string; // ISO start date
  kind: ShiftKind;
  endDate?: string; // ISO end date (EGS spans Mon–Fri)
  ancillaries?: AncillaryKind[];
  pinned?: boolean; // true = manually placed; solver must not move this shift
}
