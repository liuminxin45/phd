import { useState, useEffect, useRef } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';

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
  colorScheme?: 'blue' | 'green' | 'purple';
  disabled?: boolean;
  maxResults?: number;
}

export function UserSearchInput({
  onSelect,
  onCancel,
  placeholder = '输入用户名或 PHID',
  className = '',
  colorScheme = 'blue',
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

  const colorClasses = {
    blue: {
      border: 'border-blue-300',
      ring: 'focus:ring-blue-500',
      text: 'text-blue-600',
      hover: 'hover:bg-blue-100',
      dropdown: 'border-blue-300',
      dropdownHover: 'hover:bg-blue-50',
      selected: 'bg-blue-100',
    },
    green: {
      border: 'border-green-300',
      ring: 'focus:ring-green-500',
      text: 'text-green-600',
      hover: 'hover:bg-green-100',
      dropdown: 'border-green-300',
      dropdownHover: 'hover:bg-green-50',
      selected: 'bg-green-100',
    },
    purple: {
      border: 'border-purple-300',
      ring: 'focus:ring-purple-500',
      text: 'text-purple-600',
      hover: 'hover:bg-purple-100',
      dropdown: 'border-purple-300',
      dropdownHover: 'hover:bg-purple-50',
      selected: 'bg-purple-100',
    },
  };

  const colors = colorClasses[colorScheme];

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
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`text-[11px] px-1.5 py-0.5 border ${colors.border} rounded focus:outline-none focus:ring-1 ${colors.ring} w-40`}
            disabled={disabled || isSubmitting}
            autoFocus
          />
          {isSearching && (
            <Loader2 className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin ${colors.text}`} />
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !inputValue.trim()}
          className={`p-0.5 ${colors.text} ${colors.hover} rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          title="确认"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => {
            setInputValue('');
            setShowDropdown(false);
            onCancel();
          }}
          disabled={isSubmitting}
          className="p-0.5 text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
          title="取消"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className={`absolute top-full left-0 mt-1 w-64 bg-white border ${colors.dropdown} rounded-md shadow-lg z-50 max-h-60 overflow-y-auto`}>
          {searchResults.map((user, index) => (
            <button
              key={user.phid}
              onClick={() => handleSelectUser(user)}
              disabled={isSubmitting}
              className={`w-full px-2 py-1.5 text-left text-[11px] ${colors.dropdownHover} transition-colors disabled:opacity-50 ${
                index === selectedIndex ? colors.selected : ''
              }`}
            >
              <div className="font-medium text-neutral-900">
                {user.fields.realName}
              </div>
              <div className="text-neutral-500">@{user.fields.username}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
