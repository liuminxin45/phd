import { CalendarDays, X } from 'lucide-react';
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
      <DialogContent className="max-w-[95vw] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-orange-500" />
            <span>{year}-{String(month).padStart(2, '0')} Daily Detail</span>
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {data.totalUsers} people × {data.daysInMonth} days
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-1">
          <table className="text-xs border-collapse min-w-max w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border border-border sticky left-0 bg-muted/80 z-20">#</th>
                <th className="px-2 py-1.5 text-left font-semibold text-muted-foreground border border-border sticky left-8 bg-muted/80 z-20 min-w-[60px]">Name</th>
                {Array.from({ length: data.daysInMonth }, (_, i) => (
                  <th key={i} className={`px-1.5 py-1.5 text-center font-medium border border-border min-w-[28px] ${
                    nonWorkDays[i] ? 'bg-blue-100/50 text-blue-700' : 'bg-muted/80 text-muted-foreground'
                  }`}>{i + 1}</th>
                ))}
                <th className="px-2 py-1.5 text-center font-semibold text-muted-foreground border border-border bg-muted/80 sticky right-[52px] z-20">Sum</th>
                <th className="px-2 py-1.5 text-center font-semibold text-muted-foreground border border-border bg-muted/80 sticky right-0 z-20 min-w-[52px]">WE%</th>
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
                    <td className={`px-2 py-1 border border-border text-muted-foreground sticky left-0 z-10 ${rowBg}`}>{idx + 1}</td>
                    <td className={`px-2 py-1 border border-border font-medium sticky left-8 z-10 ${rowBg} ${isMe ? 'text-orange-600 font-bold' : 'text-foreground'}`}>
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
                        <td key={i} className={`px-1.5 py-1 border border-border text-center ${cellBg} ${cellColor}`}>
                          {v === null ? '\u00b7' : v === 0 ? '0' : v}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-1 border border-border text-center font-bold sticky right-[52px] z-10 ${rowBg} ${isMe ? 'text-orange-600' : 'text-foreground'}`}>
                      {u.monthTotal}
                    </td>
                    <td className={`px-2 py-1 border border-border text-center font-bold sticky right-0 z-10 ${wePctCls || rowBg}`}>
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
