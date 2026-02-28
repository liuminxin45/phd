import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { httpGet } from '@/lib/httpClient';
import type { GerritAccount } from '@/lib/gerrit/types';
import { getAccountName } from '@/lib/gerrit/helpers';
import { User, Loader2 } from 'lucide-react';

interface AccountSearchProps {
  placeholder?: string;
  onSelect: (account: GerritAccount) => void;
  onCancel: () => void;
}

export function AccountSearch({ placeholder = 'Search name or email...', onSelect, onCancel }: AccountSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GerritAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const accounts = await httpGet<GerritAccount[]>('/api/gerrit/accounts', { q });
      setResults(accounts || []);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        onSelect(results[activeIndex]);
      } else if (query.trim()) {
        // Allow raw input as fallback (full email)
        onSelect({ _account_id: 0, email: query.trim() } as GerritAccount);
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/* Dropdown */}
      {focused && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((account, idx) => (
            <button
              key={account._account_id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(account); }}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors',
                idx === activeIndex && 'bg-accent'
              )}
            >
              <User className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{getAccountName(account)}</span>
                {account.email && (
                  <span className="ml-1.5 text-muted-foreground truncate">{account.email}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {focused && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
          No users found
        </div>
      )}
    </div>
  );
}
