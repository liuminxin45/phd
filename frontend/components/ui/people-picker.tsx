import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Search, X, Check, Plus, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { httpClient } from '@/lib/httpClient';

interface Person {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface PeoplePickerProps {
  selected: Person[];
  onAdd: (person: Person) => void;
  onRemove: (personId: string) => void;
  maxSelections?: number;
  placeholder?: string;
  className?: string;
  popoverZIndex?: number;
}

interface UserSearchResult {
  phid: string;
  fields: {
    username: string;
    realName: string;
  };
}

export function PeoplePicker({
  selected,
  onAdd,
  onRemove,
  maxSelections,
  placeholder = '搜索人员...',
  className = '',
  popoverZIndex = 10200,
}: PeoplePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonPopoverOpen, setSelectedPersonPopoverOpen] = useState(false);
  const [addButtonPopoverOpen, setAddButtonPopoverOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search users from backend
  useEffect(() => {
    const abortController = new AbortController();
    
    const searchUsers = async () => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        setSearchResults([]);
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
          return username.includes(query) || realName.includes(query);
        });
        
        // Sort by relevance
        const sorted = filtered.sort((a, b) => {
          const aUsername = a.fields.username.toLowerCase();
          const bUsername = b.fields.username.toLowerCase();
          const aRealName = a.fields.realName.toLowerCase();
          const bRealName = b.fields.realName.toLowerCase();
          
          const aExact = aUsername === query || aRealName === query;
          const bExact = bUsername === query || bRealName === query;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          const aStarts = aUsername.startsWith(query) || aRealName.startsWith(query);
          const bStarts = bUsername.startsWith(query) || bRealName.startsWith(query);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          
          return aRealName.localeCompare(bRealName);
        });
        
        setSearchResults(sorted.slice(0, 20));
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to search users:', error);
        }
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => {
      clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [searchQuery]);

  const filteredPeople = searchResults
    .filter((user) => !selected.find((s) => s.id === user.phid))
    .map((user) => ({
      id: user.phid,
      name: user.fields.realName || user.fields.username,
      username: user.fields.username, // 保存username用于显示
      avatar: user.fields.realName?.charAt(0) || user.fields.username?.charAt(0)
    }));

  const canAddMore = !maxSelections || selected.length < maxSelections;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Selected People */}
      {selected.map((person) => (
        <Popover.Root key={person.id} open={selectedPersonPopoverOpen} onOpenChange={setSelectedPersonPopoverOpen}>
          <Popover.Trigger asChild>
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs group cursor-pointer hover:bg-blue-200 transition-colors"
            >
              <span>{person.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(person.id);
                }}
                className="hover:bg-blue-300 rounded p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-white rounded-lg border border-neutral-200 shadow-lg p-2 w-64"
              style={{ zIndex: popoverZIndex }}
              sideOffset={5}
            >
              {/* Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-blue-600"
                  autoFocus
                />
              </div>

              {/* People List */}
              <div className="max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    搜索中...
                  </div>
                ) : searchQuery.trim() === '' ? (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center">
                    请输入搜索关键词
                  </div>
                ) : filteredPeople.length > 0 ? (
                  filteredPeople.map((person) => (
                    <button
                      type="button"
                      key={person.id}
                      onClick={() => {
                        onAdd(person);
                        setSearchQuery('');
                        if (maxSelections === 1) {
                          setSelectedPersonPopoverOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded cursor-pointer transition-colors"
                    >
                      <div className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs flex-shrink-0">
                        {person.avatar}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-neutral-900">{person.name}</span>
                        {person.username && (
                          <span className="ml-1.5 text-xs text-neutral-400">@{person.username}</span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center">
                    未找到匹配的人员（共搜索 {searchResults.length} 个结果）
                  </div>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ))}

      {/* Add Button with Popover */}
      {canAddMore && (
        <Popover.Root open={addButtonPopoverOpen} onOpenChange={setAddButtonPopoverOpen}>
          <Popover.Trigger asChild>
            <button 
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 rounded text-xs transition-colors"
            >
              <Plus className="h-3 w-3" />
              添加
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="bg-white rounded-lg border border-neutral-200 shadow-lg p-2 w-64"
              style={{ zIndex: popoverZIndex }}
              sideOffset={5}
            >
              {/* Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-300 rounded focus:outline-none focus:border-blue-600"
                  autoFocus
                />
              </div>

              {/* People List */}
              <div className="max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    搜索中...
                  </div>
                ) : searchQuery.trim() === '' ? (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center">
                    请输入搜索关键词
                  </div>
                ) : filteredPeople.length > 0 ? (
                  filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        onAdd(person);
                        setSearchQuery('');
                        if (maxSelections === 1) {
                          setAddButtonPopoverOpen(false);
                        }
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded cursor-pointer transition-colors"
                    >
                      <div className="h-6 w-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs flex-shrink-0">
                        {person.avatar}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-neutral-900">{person.name}</span>
                        {person.username && (
                          <span className="ml-1.5 text-xs text-neutral-400">@{person.username}</span>
                        )}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-3 text-sm text-neutral-500 text-center">
                    未找到匹配的人员（共搜索 {searchResults.length} 个结果）
                  </div>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}
