import { CalendarDays } from 'lucide-react';
import { getMonthNonWorkingDays, getMonthWeekends } from '@/lib/chinese-holidays';
import type { ParsedDinnerData } from '@/lib/dinner/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      <DialogContent className="w-[98vw] max-w-[98vw] max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            <span>{year}-{String(month).padStart(2, '0')} Daily Detail</span>
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {data.totalUsers} people × {data.daysInMonth} days
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1">
          <table className="w-full table-fixed text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-7 px-1 py-1 text-left font-semibold text-muted-foreground border border-border sticky left-0 bg-muted/90 z-20">#</th>
                <th className="w-16 px-1 py-1 text-left font-semibold text-muted-foreground border border-border sticky left-7 bg-muted/90 z-20 truncate">Name</th>
                {Array.from({ length: data.daysInMonth }, (_, i) => (
                  <th key={i} className={`px-0.5 py-1 text-center font-medium border border-border ${
                    nonWorkDays[i] ? 'bg-blue-100/60 text-blue-700' : 'bg-muted/90 text-muted-foreground'
                  }`}>{i + 1}</th>
                ))}
                <th className="w-10 px-1 py-1 text-center font-semibold text-muted-foreground border border-border bg-muted/90 sticky right-[40px] z-20">Sum</th>
                <th className="w-10 px-1 py-1 text-center font-semibold text-muted-foreground border border-border bg-muted/90 sticky right-0 z-20">WE%</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u, idx) => {
                const isMe = data.currentUser?.employeeNo === u.employeeNo;
                const rowBg = isMe ? 'bg-orange-50/50' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/20';
                const weekendTotal = u.dailyRecords.reduce<number>((sum, v, i) => sum + (weekendDays[i] && v ? v : 0), 0);
                const wePct = u.monthTotal > 0 ? Math.round((weekendTotal / u.monthTotal) * 100) : 0;
                const wePctCls = getWeekendPctClass(wePct);
                return (
                  <tr key={u.employeeNo || u.name}>
                    <td className={`px-1 py-1 border border-border text-muted-foreground sticky left-0 z-10 ${rowBg}`}>{idx + 1}</td>
                    <td className={`px-1 py-1 border border-border font-medium sticky left-7 z-10 truncate ${rowBg} ${isMe ? 'text-orange-600 font-bold' : 'text-foreground'}`} title={u.name}>
                      {u.name}{isMe ? ' \u2605' : ''}
                    </td>
                    {Array.from({ length: data.daysInMonth }, (_, i) => {
                      const v = u.dailyRecords[i];
                      const isOff = nonWorkDays[i];
                      const cellBg = isOff
                        ? (isMe ? 'bg-blue-100/60' : idx % 2 === 0 ? 'bg-blue-50/50' : 'bg-blue-100/30')
                        : rowBg;
                      const cellColor = v === null || v === 0
                        ? 'text-muted-foreground/30'
                        : v === 1 ? 'text-green-600 font-semibold' : 'text-orange-600 font-bold';
                      return (
                        <td key={i} className={`px-0.5 py-1 border border-border text-center ${cellBg} ${cellColor}`}>
                          {v === null ? '\u00b7' : v === 0 ? '0' : v}
                        </td>
                      );
                    })}
                    <td className={`px-1 py-1 border border-border text-center font-bold sticky right-[40px] z-10 ${rowBg} ${isMe ? 'text-orange-600' : 'text-foreground'}`}>
                      {u.monthTotal}
                    </td>
                    <td className={`px-1 py-1 border border-border text-center font-bold sticky right-0 z-10 ${wePctCls || rowBg}`}>
                      {u.monthTotal > 0 ? `${wePct}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
