import { CalendarDays, X } from 'lucide-react';
import { getMonthNonWorkingDays, getMonthWeekends } from '@/lib/chinese-holidays';
import type { ParsedDinnerData } from '@/lib/dinner/types';

interface DailyDetailModalProps {
  data: ParsedDinnerData;
  year: number;
  month: number;
  onClose: () => void;
}

const WEEKEND_PCT_STYLES: Array<{ max: number; cls: string }> = [
  { max: 20, cls: '' },
  { max: 30, cls: 'bg-amber-100' },
  { max: 40, cls: 'bg-amber-200' },
  { max: 50, cls: 'bg-orange-300' },
  { max: Infinity, cls: 'bg-red-400 text-white' },
];

function getWeekendPctClass(pct: number): string {
  return WEEKEND_PCT_STYLES.find(s => pct < s.max)?.cls ?? '';
}

export function DailyDetailModal({ data, year, month, onClose }: DailyDetailModalProps) {
  const nonWorkDays = getMonthNonWorkingDays(year, month);
  const weekendDays = getMonthWeekends(year, month);
  const sortedUsers = [...data.allUsers].sort((a, b) => b.monthTotal - a.monthTotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-neutral-900">
              {year}-{String(month).padStart(2, '0')} Daily Detail
            </h3>
            <span className="text-xs text-neutral-400">{data.totalUsers} people × {data.daysInMonth} days</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="overflow-auto p-1">
          <table className="text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-neutral-600 border border-neutral-200 sticky left-0 bg-neutral-50 z-20">#</th>
                <th className="px-2 py-1.5 text-left font-semibold text-neutral-600 border border-neutral-200 sticky left-8 bg-neutral-50 z-20 min-w-[60px]">Name</th>
                {Array.from({ length: data.daysInMonth }, (_, i) => (
                  <th key={i} className={`px-1.5 py-1.5 text-center font-medium border border-neutral-200 min-w-[28px] ${
                    nonWorkDays[i] ? 'bg-blue-100 text-blue-700' : 'bg-neutral-50 text-neutral-500'
                  }`}>{i + 1}</th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold text-neutral-600 border border-neutral-200 bg-neutral-50 sticky right-[52px] z-20">Sum</th>
                <th className="px-2 py-1.5 text-center font-semibold text-neutral-600 border border-neutral-200 bg-neutral-50 sticky right-0 z-20 min-w-[52px]">WE%</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u, idx) => {
                const isMe = data.currentUser?.employeeNo === u.employeeNo;
                const rowBg = isMe ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50';
                const weekendTotal = u.dailyRecords.reduce<number>((sum, v, i) => sum + (weekendDays[i] && v ? v : 0), 0);
                const wePct = u.monthTotal > 0 ? Math.round((weekendTotal / u.monthTotal) * 100) : 0;
                const wePctCls = getWeekendPctClass(wePct);
                return (
                  <tr key={u.employeeNo || u.name}>
                    <td className={`px-2 py-1 border border-neutral-200 text-neutral-400 sticky left-0 z-10 ${rowBg}`}>{idx + 1}</td>
                    <td className={`px-2 py-1 border border-neutral-200 font-medium sticky left-8 z-10 ${rowBg} ${isMe ? 'text-orange-700' : 'text-neutral-800'}`}>
                      {u.name}{isMe ? ' \u2605' : ''}
                    </td>
                    {Array.from({ length: data.daysInMonth }, (_, i) => {
                      const v = u.dailyRecords[i];
                      const isOff = nonWorkDays[i];
                      const cellBg = isOff
                        ? (isMe ? 'bg-blue-100/60' : idx % 2 === 0 ? 'bg-blue-50' : 'bg-blue-100/40')
                        : rowBg;
                      const cellColor = v === null || v === 0
                        ? 'text-neutral-300'
                        : v === 1 ? 'text-green-600 font-semibold' : 'text-orange-600 font-bold';
                      return (
                        <td key={i} className={`px-1.5 py-1 border border-neutral-200 text-center ${cellBg} ${cellColor}`}>
                          {v === null ? '\u00b7' : v === 0 ? '0' : v}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1 border border-neutral-200 text-center font-bold sticky right-[52px] z-10 ${rowBg} ${isMe ? 'text-orange-700' : 'text-neutral-800'}`}>
                      {u.monthTotal}
                    </td>
                    <td className={`px-2 py-1 border border-neutral-200 text-center font-bold sticky right-0 z-10 ${wePctCls || rowBg}`}>
                      {u.monthTotal > 0 ? `${wePct}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
