import { useState } from 'react';
import { ImportButton } from '../controls/ImportButton';
import { ExportButton } from '../controls/ExportButton';
import { SaveScheduleButton } from '../history/SaveScheduleButton';
import { HistoryModal } from '../history/HistoryModal';
import { useSavedSchedules } from '../../hooks/useSavedSchedules';

export function Header() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { saves } = useSavedSchedules();

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <h1 className="text-base font-bold text-slate-800 whitespace-nowrap">
          On-Call Scheduler <span className="font-normal ml-2" style={{ color: '#808A8F' }}>DRV Antioch</span>
        </h1>

        <div className="flex items-center gap-2">
          <ImportButton />
          <ExportButton />
          <div className="w-px h-5 bg-slate-200" />
          <SaveScheduleButton />
          <button
            onClick={() => setHistoryOpen(true)}
            className="relative border text-slate-600 text-sm h-8 px-3 rounded transition-colors"
            style={{ borderColor: '#ABB5BB' }}
          >
            History
            {saves.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {saves.length > 9 ? '9+' : saves.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </>
  );
}
