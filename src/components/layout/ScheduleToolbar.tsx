import { ClearButton } from '../controls/ClearButton';
import { GenerateButton } from '../controls/GenerateButton';
import { MonthRangePicker } from '../controls/MonthRangePicker';
import { RangePicker } from '../controls/RangePicker';

export function ScheduleToolbar() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-4">
        <RangePicker />
        <div className="w-px h-5 bg-slate-200" />
        <MonthRangePicker />
      </div>
      <div className="flex items-center gap-2">
        <ClearButton />
        <GenerateButton />
      </div>
    </div>
  );
}
