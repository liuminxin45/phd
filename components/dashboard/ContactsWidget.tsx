import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  BookUser,
  Building2,
  ChevronsDownUp,
  ChevronsUpDown,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { httpClient } from '@/lib/httpClient';
import { cn } from '@/lib/utils';
import { glassInputClass, glassPanelStrongClass, glassSectionClass, glassToolbarClass } from '@/components/ui/glass';
import type {
  ContactChangedRecord,
  ContactFieldChange,
  ContactRecord,
  ContactsDiff,
  ContactsSnapshot,
  ContactsSnapshotResponse,
  ContactsTrendPoint,
} from '@/lib/contacts/types';

interface ContactsWidgetProps {
  className?: string;
}

type ContactsTab = 'list' | 'diff' | 'trend';

const CONTACT_CARD_HEIGHT = 164;
const CONTACT_LIST_HEIGHT = 544;
const CONTACT_LIST_OVERSCAN = 6;
const STAT_CARD_CLASS = 'glass-interactive rounded-xl border border-white/58 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 transition-all duration-200 hover:border-sky-200/80 hover:bg-white/74';
const ICON_BUTTON_CLASS = 'h-9 w-9 rounded-xl border border-white/45 bg-white/42 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/66';
const GLASS_SELECT_TRIGGER_CLASS = 'h-9 w-full rounded-xl border border-white/55 bg-white/72 px-3 text-sm shadow-none';

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateOptions(selectedDate: string, today: string, availableDates: string[]): string[] {
  return Array.from(new Set([selectedDate, today, ...availableDates].filter(Boolean))).sort((a, b) => b.localeCompare(a));
}

function getDefaultCompareDates(availableDates: string[], today: string): { from: string; to: string } {
  const options = buildDateOptions('', today, availableDates);
  if (options.length === 0) {
    return { from: today, to: today };
  }
  if (options.length === 1) {
    return { from: options[0], to: options[0] };
  }
  return { from: options[1], to: options[0] };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(' / ') : '--';
}

function formatTrendDate(value: string): string {
  return value.slice(5);
}

function matchesQuery(contact: ContactRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    contact.name,
    contact.department,
    ...contact.phones,
    ...contact.locations,
    ...contact.emails,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function fieldLabel(field: ContactFieldChange['field']): string {
  switch (field) {
    case 'name':
      return 'Name';
    case 'department':
      return 'Department';
    case 'phones':
      return 'Phone';
    case 'locations':
      return 'Location';
    case 'emails':
      return 'Email';
    default:
      return field;
  }
}

function ContactCard({ contact }: { contact: ContactRecord }) {
  return (
    <div className="glass-interactive rounded-xl border border-white/58 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{contact.name}</span>
            <Badge variant="outline" className="text-[10px]">
              #{contact.index}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{contact.department || '--'}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <div className="rounded-lg border border-white/55 bg-white/64 px-2 py-2">
          <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <Phone className="h-3.5 w-3.5" />
            Phone
          </div>
          <p className="break-all">{formatList(contact.phones)}</p>
        </div>
        <div className="rounded-lg border border-white/55 bg-white/64 px-2 py-2">
          <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Location
          </div>
          <p>{formatList(contact.locations)}</p>
        </div>
        <div className="rounded-lg border border-white/55 bg-white/64 px-2 py-2">
          <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <Mail className="h-3.5 w-3.5" />
            Email
          </div>
          <p className="break-all">{formatList(contact.emails)}</p>
        </div>
      </div>
    </div>
  );
}

function VirtualContactsList({ contacts }: { contacts: ContactRecord[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [contacts]);

  const totalHeight = contacts.length * CONTACT_CARD_HEIGHT;
  const visibleCount = Math.ceil(CONTACT_LIST_HEIGHT / CONTACT_CARD_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / CONTACT_CARD_HEIGHT) - CONTACT_LIST_OVERSCAN);
  const endIndex = Math.min(
    contacts.length,
    startIndex + visibleCount + CONTACT_LIST_OVERSCAN * 2,
  );
  const visibleContacts = contacts.slice(startIndex, endIndex);

  return (
    <div
      ref={scrollRef}
      className="overflow-auto pr-1"
      style={{ height: CONTACT_LIST_HEIGHT }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleContacts.map((contact, offset) => {
          const index = startIndex + offset;
          return (
            <div
              key={contact.key}
              style={{
                position: 'absolute',
                top: index * CONTACT_CARD_HEIGHT,
                left: 0,
                right: 0,
                height: CONTACT_CARD_HEIGHT - 8,
              }}
            >
              <ContactCard contact={contact} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffFieldChips({ fieldsChanged }: { fieldsChanged: ContactFieldChange[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fieldsChanged.map((field) => (
        <Badge key={field.field} variant="outline" className="bg-background text-[11px]">
          {fieldLabel(field.field)}
        </Badge>
      ))}
    </div>
  );
}

function ChangedContactCard({ item }: { item: ContactChangedRecord }) {
  return (
    <div className="rounded-xl border border-white/58 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.after.name}</p>
          <p className="text-xs text-muted-foreground">{item.after.department || '--'}</p>
        </div>
        <DiffFieldChips fieldsChanged={item.fieldsChanged} />
      </div>
      <div className="mt-3 space-y-2 text-xs">
        {item.fieldsChanged.map((field) => (
          <div key={field.field} className="rounded-lg border border-white/55 bg-white/64 p-2">
            <p className="font-medium text-foreground">{fieldLabel(field.field)}</p>
            <p className="mt-1 text-muted-foreground">
              {Array.isArray(field.before) ? formatList(field.before) : (field.before || '--')}
              {' -> '}
              {Array.isArray(field.after) ? formatList(field.after) : (field.after || '--')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactSection({
  title,
  emptyText,
  contacts,
  tone,
}: {
  title: string;
  emptyText: string;
  contacts: ContactRecord[];
  tone: 'green' | 'red';
}) {
  const toneClass = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700'
    : 'border-rose-200 bg-rose-50/60 text-rose-700';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="outline" className={cn('text-[11px]', toneClass)}>
          {contacts.length}
        </Badge>
      </div>
      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div key={contact.key} className="rounded-xl border border-white/58 bg-white/62 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                  <p className="text-xs text-muted-foreground">{contact.department || '--'}</p>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  #{contact.index}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                <div>Phone: {formatList(contact.phones)}</div>
                <div>Location: {formatList(contact.locations)}</div>
                <div>Email: {formatList(contact.emails)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactsWidget({ className = '' }: ContactsWidgetProps) {
  const initialToday = formatLocalDateKey(new Date());
  const [today, setToday] = useState(initialToday);
  const [selectedDate, setSelectedDate] = useState(initialToday);
  const [snapshot, setSnapshot] = useState<ContactsSnapshot | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ContactsTab>('list');
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [compareFrom, setCompareFrom] = useState(initialToday);
  const [compareTo, setCompareTo] = useState(initialToday);
  const [diff, setDiff] = useState<ContactsDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [summaryDiff, setSummaryDiff] = useState<ContactsDiff | null>(null);
  const [trendPoints, setTrendPoints] = useState<ContactsTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [lastAvailableDate, setLastAvailableDate] = useState<string | null>(null);
  const lastLocalDayRef = useRef(initialToday);
  const yesterdayRef = useRef('');
  if (!yesterdayRef.current) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterdayRef.current = formatLocalDateKey(yesterday);
  }
  const yesterday = yesterdayRef.current;

  const loadSnapshot = useCallback(async (
    date: string,
    options: { refresh?: boolean; silent?: boolean } = {},
  ) => {
    const { refresh = false, silent = false } = options;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await httpClient<ContactsSnapshotResponse>('/api/contacts', {
        params: {
          date,
          refresh: refresh ? 'true' : undefined,
        },
      });

      setSnapshot(response.snapshot);
      setAvailableDates(response.availableDates);
      setToday(response.today);
      setError(null);

      setCompareFrom((current) => {
        if (current) return current;
        return getDefaultCompareDates(response.availableDates, response.today).from;
      });
      setCompareTo((current) => {
        if (current) return current;
        return getDefaultCompareDates(response.availableDates, response.today).to;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
      if (silent) {
        toast.error(err.message || 'Failed to refresh contacts');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadDiff = useCallback(async (from: string, to: string, onSuccess?: (result: ContactsDiff) => void) => {
    if (!from || !to) {
      toast.error('Please select two dates for comparison');
      return;
    }

    setDiffLoading(true);
    try {
      const result = await httpClient<ContactsDiff>('/api/contacts/compare', {
        params: { from, to },
      });
      setDiff(result);
      onSuccess?.(result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to compare contact differences');
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const result = await httpClient<ContactsTrendPoint[]>('/api/contacts/trend', {
        params: { limit: 30 },
      });
      setTrendPoints(result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load contact trends');
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(selectedDate);
  }, [loadSnapshot, selectedDate]);

  useEffect(() => {
    const defaults = getDefaultCompareDates(availableDates, today);
    if (compareFrom === compareTo && compareFrom === today && defaults.from !== defaults.to) {
      setCompareFrom(defaults.from);
      setCompareTo(defaults.to);
    }
  }, [availableDates, compareFrom, compareTo, today]);

  useEffect(() => {
    // 找到 today 之前最近的有数据日期
    const findPreviousAvailableDate = (): string | null => {
      if (!availableDates.includes(today)) return null;

      // 从昨天开始往前找，最多找30天
      for (let i = 1; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = formatLocalDateKey(date);
        if (availableDates.includes(dateKey)) {
          return dateKey;
        }
      }
      return null;
    };

    const previousDate = findPreviousAvailableDate();
    setLastAvailableDate(previousDate);

    if (!previousDate) {
      setSummaryDiff(null);
      return;
    }

    void httpClient<ContactsDiff>('/api/contacts/compare', {
      params: { from: previousDate, to: today },
    }).then((result) => {
      setSummaryDiff(result);
    }).catch(() => {
      setSummaryDiff(null);
    });
  }, [availableDates, today]);

  useEffect(() => {
    if (!detailsExpanded || trendPoints.length > 0) {
      return;
    }
    void loadTrend();
  }, [detailsExpanded, loadTrend, trendPoints.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextToday = formatLocalDateKey(new Date());
      const previousToday = lastLocalDayRef.current;

      if (nextToday === previousToday) {
        return;
      }

      lastLocalDayRef.current = nextToday;
      setToday(nextToday);

      void httpClient<ContactsSnapshotResponse>('/api/contacts', {
        params: { date: nextToday },
      }).then((response) => {
        setAvailableDates(response.availableDates);

        if (selectedDate === previousToday || selectedDate === nextToday) {
          setSelectedDate(nextToday);
          setSnapshot(response.snapshot);
        }

        setCompareTo((current) => current === previousToday || !current ? nextToday : current);
        setTrendPoints([]);
      }).catch(() => {
        toast.error('Failed to auto-pull contacts across days');
      });
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [selectedDate]);

  const dateOptions = useMemo(
    () => buildDateOptions(selectedDate, today, availableDates),
    [availableDates, selectedDate, today],
  );

  const filteredContacts = useMemo(
    () => (snapshot?.contacts || []).filter((contact) => matchesQuery(contact, query)),
    [query, snapshot?.contacts],
  );

  const trendAxisConfig = useMemo(() => {
    if (trendPoints.length === 0) {
      return {
        totalDomain: [0, 1] as [number, number],
        deltaDomain: [0, 1] as [number, number],
      };
    }

    const totalValues = trendPoints.map((point) => point.totalContacts);
    const totalMin = Math.min(...totalValues);
    const totalMax = Math.max(...totalValues);
    const totalPadding = Math.max(1, Math.ceil((totalMax - totalMin || 1) * 0.2));

    const deltaMaxRaw = Math.max(
      1,
      ...trendPoints.map((point) => Math.max(point.added, point.removed)),
    );
    const deltaDomainMax = Math.max(2, Math.ceil(deltaMaxRaw * 1.25));

    return {
      totalDomain: [Math.max(0, totalMin - totalPadding), totalMax + totalPadding] as [number, number],
      deltaDomain: [0, deltaDomainMax] as [number, number],
    };
  }, [trendPoints]);

  const handleRefresh = async () => {
    const isToday = selectedDate === today;
    await loadSnapshot(selectedDate, { refresh: isToday, silent: true });
    setTrendPoints([]);
    if (!isToday) {
      toast.info('Historical dates show local cached snapshots; only today supports re-fetch');
    }
  };

  const renderValue = (value: number | null) => (value === null ? '-' : value);

  return (
    <Card className={cn(glassPanelStrongClass, 'overflow-hidden border-white/65 bg-white/62 shadow-[0_22px_52px_rgba(15,23,42,0.16)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56', className)}>
      <div className="flex items-center justify-between border-b border-white/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-200/70 bg-cyan-50/82 text-cyan-700">
            <BookUser className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold leading-none">Contacts</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={ICON_BUTTON_CLASS}
          onClick={() => setDetailsExpanded((prev) => !prev)}
          aria-expanded={detailsExpanded}
          aria-label={detailsExpanded ? 'Collapse Contacts details' : 'Expand Contacts details'}
        >
          {detailsExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
        </Button>
      </div>

      <CardContent className="p-4">
        {loading && !snapshot ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            {detailsExpanded && (
              <>
                <Skeleton className="h-12" />
                <Skeleton className="h-64" />
              </>
            )}
          </div>
        ) : error && !snapshot ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookUser className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm">{error}</p>
            <Button variant="link" onClick={() => void loadSnapshot(selectedDate)} className="mt-2 h-auto p-0">
              Retry
            </Button>
          </div>
        ) : snapshot ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className={STAT_CARD_CLASS}>
                <div className="mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs font-medium text-muted-foreground">Contacts</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{snapshot.totalContacts}</p>
                <p className="text-[10px] text-muted-foreground">{snapshot.snapshotDate}</p>
              </div>
              <div className={STAT_CARD_CLASS}>
                <div className="mb-1 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-muted-foreground">Department</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{snapshot.statistics.departments}</p>
                <p className="text-[10px] text-muted-foreground">Based on snapshot statistics</p>
              </div>
              <div className={STAT_CARD_CLASS}>
                <div className="mb-1 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-muted-foreground">Added Members</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{renderValue(summaryDiff?.summary.added ?? null)}</p>
                <p className="text-[10px] text-muted-foreground">{lastAvailableDate ? `对比 ${lastAvailableDate.slice(5)} 的数据` : 'No previous data'}</p>
              </div>
              <div className={STAT_CARD_CLASS}>
                <div className="mb-1 flex items-center gap-2">
                  <UserMinus className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-medium text-muted-foreground">Removed Members</span>
                </div>
                <p className="text-2xl font-bold tracking-tight">{renderValue(summaryDiff?.summary.removed ?? null)}</p>
                <p className="text-[10px] text-muted-foreground">{lastAvailableDate ? `对比 ${lastAvailableDate.slice(5)} 的数据` : 'No previous data'}</p>
              </div>
            </div>

            {detailsExpanded && (
              <div className="space-y-6">
                <div className={cn(glassSectionClass, "flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between")}>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Current Snapshot</span>
                    <span className="rounded-lg border border-white/55 bg-white/72 px-2 py-1 font-mono text-xs text-slate-700 backdrop-blur-lg">
                      {selectedDate}
                    </span>
                    <span className="text-xs">Fetched At {new Date(snapshot.fetchedAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant={activeTab === 'list' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 rounded-xl border border-white/50 bg-white/65 px-3 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl hover:bg-white/78", activeTab === 'list' && "border-sky-200/90 bg-sky-50/82 text-sky-700")} onClick={() => setActiveTab('list')}>
                      List
                    </Button>
                    <Button type="button" variant={activeTab === 'diff' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 rounded-xl border border-white/50 bg-white/65 px-3 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl hover:bg-white/78 gap-1.5", activeTab === 'diff' && "border-sky-200/90 bg-sky-50/82 text-sky-700")} onClick={() => setActiveTab('diff')}>
                      <ArrowRightLeft className="h-4 w-4" />
                      Diff
                    </Button>
                    <Button type="button" variant={activeTab === 'trend' ? 'secondary' : 'ghost'} size="sm" className={cn("h-9 rounded-xl border border-white/50 bg-white/65 px-3 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur-xl hover:bg-white/78 gap-1.5", activeTab === 'trend' && "border-sky-200/90 bg-sky-50/82 text-sky-700")} onClick={() => setActiveTab('trend')}>
                      <TrendingUp className="h-4 w-4" />
                      Added Trend
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className={ICON_BUTTON_CLASS} onClick={handleRefresh} disabled={refreshing || loading} aria-label="Refresh contacts">
                      <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                {activeTab === 'list' && (
                  <>
                    <div className={cn(glassSectionClass, "grid gap-3 rounded-2xl p-3 lg:grid-cols-[180px_minmax(0,1fr)]")}>
                      <label className="space-y-2 text-xs font-medium text-foreground">
                        <span className="block">Snapshot Date</span>
                        <Select value={selectedDate} onValueChange={setSelectedDate}>
                          <SelectTrigger className={GLASS_SELECT_TRIGGER_CLASS}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dateOptions.map((date) => (
                              <SelectItem key={date} value={date}>
                                {date}{date === today ? ' (Today)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="space-y-2 text-xs font-medium text-foreground">
                        <span className="block">Search Contacts</span>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Name / Phone / Email / Department / Location"
                            className={cn(glassInputClass, "pl-9")}
                          />
                        </div>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-white/58 bg-[linear-gradient(180deg,rgba(8,145,178,0.06),rgba(8,145,178,0)_36%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.96))] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/64">
                      <div className="mb-3 flex items-center justify-between">
                       <div>
                          <h4 className="text-sm font-semibold text-foreground">Contact List</h4>
                        </div>
                      </div>

                      {filteredContacts.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No matching contacts
                        </div>
                      ) : (
                        <VirtualContactsList contacts={filteredContacts} />
                      )}
                    </div>
                  </>
                )}

                {activeTab === 'diff' && (
                  <div className="space-y-6">
                    <div className={cn(glassSectionClass, "grid gap-3 rounded-2xl p-3 lg:grid-cols-[1fr_1fr_auto]")}>
                      <label className="space-y-2 text-xs font-medium text-foreground">
                        <span className="block">Base Date</span>
                        <Select value={compareFrom} onValueChange={setCompareFrom}>
                          <SelectTrigger className={GLASS_SELECT_TRIGGER_CLASS}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dateOptions.map((date) => (
                              <SelectItem key={`from-${date}`} value={date}>
                                {date}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="space-y-2 text-xs font-medium text-foreground">
                        <span className="block">Target Date</span>
                        <Select value={compareTo} onValueChange={setCompareTo}>
                          <SelectTrigger className={GLASS_SELECT_TRIGGER_CLASS}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dateOptions.map((date) => (
                              <SelectItem key={`to-${date}`} value={date}>
                                {date}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>

                      <div className="flex items-end">
                        <Button type="button" className="h-9 w-full rounded-xl border border-sky-300/75 bg-sky-500 text-white hover:bg-sky-600 lg:w-auto" onClick={() => void loadDiff(compareFrom, compareTo)} disabled={diffLoading}>
                          {diffLoading ? 'Comparing...' : 'Generate Diff'}
                        </Button>
                      </div>
                    </div>

                    {diff ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div className={STAT_CARD_CLASS}>
                            <p className="text-xs text-muted-foreground">Added Members</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-600">{diff.summary.added}</p>
                          </div>
                          <div className={STAT_CARD_CLASS}>
                            <p className="text-xs text-muted-foreground">Removed Members</p>
                            <p className="mt-1 text-2xl font-bold text-rose-600">{diff.summary.removed}</p>
                          </div>
                          <div className={STAT_CARD_CLASS}>
                            <p className="text-xs text-muted-foreground">Changed Members</p>
                            <p className="mt-1 text-2xl font-bold text-amber-600">{diff.summary.changed}</p>
                          </div>
                          <div className={STAT_CARD_CLASS}>
                            <p className="text-xs text-muted-foreground">Unchanged</p>
                            <p className="mt-1 text-2xl font-bold text-cyan-700">{diff.summary.unchanged}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/58 bg-white/60 p-3 text-sm text-muted-foreground backdrop-blur-lg">
                          {diff.fromDate} Total {diff.summary.totalBefore} people，{diff.toDate} Total {diff.summary.totalAfter} people。
                        </div>

                        <ContactSection title="Added Members" emptyText="No new members between these two days" contacts={diff.added} tone="green" />
                        <ContactSection title="Removed Members" emptyText="No removed members between these two days" contacts={diff.removed} tone="red" />

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">Changed Members</h4>
                            <Badge variant="outline" className="bg-amber-50 text-[11px] text-amber-700">
                              {diff.changed.length}
                            </Badge>
                          </div>
                          {diff.changed.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                              No field changes between these two days
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {diff.changed.map((item) => (
                                <ChangedContactCard key={item.key} item={item} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Select two dates and click "Generate Diff" to view added, removed, and changed fields
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'trend' && (
                  <div className={cn(glassSectionClass, "rounded-2xl p-4")}>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Headcount Trend</h4>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        Last {trendPoints.length} days
                      </Badge>
                    </div>

                    {trendLoading ? (
                      <Skeleton className="h-72" />
                    ) : trendPoints.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Not enough snapshot data to render trends yet
                      </div>
                    ) : (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={trendPoints} margin={{ top: 12, right: 12, left: -16, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatTrendDate}
                              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              yAxisId="total"
                              allowDecimals={false}
                              domain={trendAxisConfig.totalDomain}
                              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              yAxisId="delta"
                              orientation="right"
                              allowDecimals={false}
                              domain={trendAxisConfig.deltaDomain}
                              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              cursor={{ fill: 'hsl(var(--muted)/0.25)' }}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                                fontSize: '12px',
                              }}
                              formatter={(value: number, name: string) => {
                                if (name === 'totalContacts') {
                                  return [`${value} people`, 'Total'];
                                }
                                if (name === 'added') {
                                  return [`+${value} people`, 'Added'];
                                }
                                return [`-${value} people`, 'Removed'];
                              }}
                              labelFormatter={(label, payload) => {
                                const point = payload?.[0]?.payload as ContactsTrendPoint | undefined;
                                return `${label}${point ? ` · Net change ${point.added - point.removed}` : ''}`;
                              }}
                            />
                            <Bar yAxisId="delta" dataKey="added" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="delta" dataKey="removed" fill="hsl(350 84% 60%)" radius={[4, 4, 0, 0]} />
                            <Line
                              yAxisId="total"
                              type="monotone"
                              dataKey="totalContacts"
                              stroke="hsl(197 85% 42%)"
                              strokeWidth={2.75}
                              dot={{ r: 3.5, fill: 'hsl(197 85% 42%)' }}
                              activeDot={{ r: 5 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookUser className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm">No contact snapshot for current date yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
