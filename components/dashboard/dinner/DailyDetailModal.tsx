import { CalendarDays } from 'lucide-react';
import { getMonthNonWorkingDays, getMonthWeekends } from '@/lib/chinese-holidays';
import type { ParsedDinnerData } from '@/lib/dinner/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { glassPanelStrongClass } from '@/components/ui/glass';

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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(glassPanelStrongClass, "h-[90vh] w-[min(1560px,99vw)] max-w-[min(1560px,99vw)] overflow-hidden rounded-[30px] border border-white/70 bg-[#f8fbff]/92 p-0 shadow-[0_30px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
        <DialogHeader className="shrink-0 border-b border-white/60 bg-white/52 px-6 py-4 backdrop-blur-xl">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-900">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            <span>{year}-{String(month).padStart(2, '0')} Daily Detail</span>
            <span className="ml-1 rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-xs font-normal text-slate-600">
              {data.totalUsers} people × {data.daysInMonth} days
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.46),rgba(241,245,249,0.18))] p-3">
          <div className="rounded-[24px] border border-white/60 bg-white/62 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[11px] xl:text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-30 w-9 border border-white/60 bg-white/88 px-1.5 py-2 text-left font-semibold text-slate-500 shadow-[4px_0_12px_rgba(255,255,255,0.55)]">#</th>
                <th className="sticky left-9 z-30 w-28 border border-white/60 bg-white/88 px-2 py-2 text-left font-semibold text-slate-500 shadow-[4px_0_12px_rgba(255,255,255,0.55)] xl:w-32">Name</th>
                {Array.from({ length: data.daysInMonth }, (_, i) => (
                  <th key={i} className={`w-7 border border-white/55 px-0.5 py-2 text-center font-medium xl:w-8 ${
                    nonWorkDays[i] ? 'bg-sky-100/65 text-sky-700' : 'bg-white/80 text-slate-500'
                  }`}>{i + 1}</th>
                ))}
                <th className="sticky right-[48px] z-30 w-12 border border-white/60 bg-white/88 px-1.5 py-2 text-center font-semibold text-slate-500 shadow-[-4px_0_12px_rgba(255,255,255,0.55)]">Sum</th>
                <th className="sticky right-0 z-30 w-12 border border-white/60 bg-white/88 px-1.5 py-2 text-center font-semibold text-slate-500 shadow-[-4px_0_12px_rgba(255,255,255,0.55)]">WE%</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u, idx) => {
                const isMe = data.currentUser?.employeeNo === u.employeeNo;
                const rowBg = isMe ? 'bg-orange-50/72' : idx % 2 === 0 ? 'bg-white/60' : 'bg-slate-50/60';
                const weekendTotal = u.dailyRecords.reduce<number>((sum, v, i) => sum + (weekendDays[i] && v ? v : 0), 0);
                const wePct = u.monthTotal > 0 ? Math.round((weekendTotal / u.monthTotal) * 100) : 0;
                const wePctCls = getWeekendPctClass(wePct);
                return (
                  <tr key={u.employeeNo || u.name}>
                    <td className={`sticky left-0 z-20 border border-white/55 px-1.5 py-2 text-slate-500 ${rowBg}`}>{idx + 1}</td>
                    <td className={`sticky left-9 z-20 truncate border border-white/55 px-2 py-2 font-medium ${rowBg} ${isMe ? 'font-bold text-orange-600' : 'text-slate-800'}`} title={u.name}>
                      <span className="truncate">{u.name}{isMe ? ' \u2605' : ''}</span>
                    </td>
                    {Array.from({ length: data.daysInMonth }, (_, i) => {
                      const v = u.dailyRecords[i];
                      const isOff = nonWorkDays[i];
                      const cellBg = isOff
                        ? (isMe ? 'bg-sky-100/70' : idx % 2 === 0 ? 'bg-sky-50/52' : 'bg-sky-100/36')
                        : rowBg;
                      const cellColor = v === null || v === 0
                        ? 'text-slate-300'
                        : v === 1 ? 'font-semibold text-emerald-600' : 'font-bold text-orange-600';
                      return (
                        <td key={i} className={`border border-white/45 px-0.5 py-2 text-center ${cellBg} ${cellColor}`}>
                          {v === null ? '\u00b7' : v === 0 ? '0' : v}
                        </td>
                      );
                    })}
                    <td className={`sticky right-[48px] z-20 border border-white/55 px-1.5 py-2 text-center font-bold ${rowBg} ${isMe ? 'text-orange-600' : 'text-slate-800'}`}>
                      {u.monthTotal}
                    </td>
                    <td className={`sticky right-0 z-20 border border-white/55 px-1.5 py-2 text-center font-bold ${wePctCls || rowBg}`}>
                      {u.monthTotal > 0 ? `${wePct}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
