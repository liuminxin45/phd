import { useState, useEffect, useRef } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserSearchResult {
  phid: string;
  fields: {
    username: string;
    realName: string;
  };
}

interface UserSearchInputProps {
  onSelect: (phid: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  colorScheme?: 'blue' | 'green' | 'purple'; // Keeping prop for API compatibility but might standardize styles
  disabled?: boolean;
  maxResults?: number;
}

export function UserSearchInput({
  onSelect,
  onCancel,
  placeholder = '输入用户名或 PHID',
  className = '',
  disabled = false,
  maxResults = 20,
}: UserSearchInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search users when input changes
  useEffect(() => {
    const abortController = new AbortController();
    
    const searchUsers = async () => {
      const query = inputValue.trim().toLowerCase();
      if (!query || query.startsWith('phid-')) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await httpClient<{ data: UserSearchResult[] }>('/api/users', {
          signal: abortController.signal,
        });
        
        // Filter users by username or realName
        const filtered = response.data.filter((user) => {
          const username = user.fields.username.toLowerCase();
          const realName = user.fields.realName.toLowerCase();
          
          // Check if query matches username or realName
          return username.includes(query) || realName.includes(query);
        });
        
        // Sort by relevance: exact matches first, then starts with, then contains
        const sorted = filtered.sort((a, b) => {
          const aUsername = a.fields.username.toLowerCase();
          const bUsername = b.fields.username.toLowerCase();
          const aRealName = a.fields.realName.toLowerCase();
          const bRealName = b.fields.realName.toLowerCase();
          
          // Exact match
          if (aUsername === query || aRealName === query) return -1;
          if (bUsername === query || bRealName === query) return 1;
          
          // Starts with
          if (aUsername.startsWith(query) || aRealName.startsWith(query)) return -1;
          if (bUsername.startsWith(query) || bRealName.startsWith(query)) return 1;
          
          return 0;
        });
        
        setSearchResults(sorted.slice(0, maxResults));
        setShowDropdown(sorted.length > 0);
        setSelectedIndex(-1);
      } catch (error: any) {
        // Ignore abort errors
        if (error.name !== 'AbortError') {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => {
      clearTimeout(debounce);
      abortController.abort();
    };
  }, [inputValue, maxResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async () => {
    const phid = inputValue.trim();
    if (!phid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSelect(phid);
      setInputValue('');
      setShowDropdown(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectUser = async (user: UserSearchResult) => {
    setIsSubmitting(true);
    try {
      await onSelect(user.phid);
      setInputValue('');
      setShowDropdown(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectUser(searchResults[selectedIndex]);
        } else {
          handleSubmit();
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        onCancel();
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <div className="flex items-center gap-1">
        <div className="relative">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-7 text-xs w-40 px-2 pr-6"
            disabled={disabled || isSubmitting}
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !inputValue.trim()}
          className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
          title="确认"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setInputValue('');
            setShowDropdown(false);
            onCancel();
          }}
          disabled={isSubmitting}
          className="h-7 w-7 hover:bg-muted text-muted-foreground hover:text-foreground"
          title="取消"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {searchResults.map((user, index) => (
            <button
              key={user.phid}
              onClick={() => handleSelectUser(user)}
              disabled={isSubmitting}
              className={cn(
                "w-full px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 hover:bg-accent hover:text-accent-foreground",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
            >
              <div className="font-medium">
                {user.fields.realName}
              </div>
              <div className="text-muted-foreground">@{user.fields.username}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
