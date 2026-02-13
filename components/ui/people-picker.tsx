import * as React from 'react';
import { Search, X, Plus, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { httpClient } from '@/lib/httpClient';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Person } from '@/lib/types';

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
    image?: string;
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
  const [open, setOpen] = useState(false);
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
      username: user.fields.username,
      avatar: user.fields.image
    }));

  const canAddMore = !maxSelections || selected.length < maxSelections;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Selected People */}
      {selected.map((person) => (
        <Badge
          key={person.id}
          variant="secondary"
          className="gap-1 pr-1 pl-1 py-0.5 hover:bg-secondary/80 flex items-center"
        >
          <Avatar className="h-4 w-4">
            <AvatarImage src={person.avatar} alt={person.name} />
            <AvatarFallback className="text-[9px]">{person.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="ml-1">{person.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(person.id);
            }}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors focus:outline-none"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add Button with Popover */}
      {canAddMore && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-dashed gap-1 text-muted-foreground hover:text-foreground px-2"
            >
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-2" 
            align="start" 
            style={{ zIndex: popoverZIndex }}
          >
            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>

            {/* People List */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {isSearching ? (
                <div className="py-4 text-center flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  搜索中...
                </div>
              ) : searchQuery.trim() === '' ? (
                <div className="py-4 text-center text-muted-foreground text-xs">
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
                        setOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={person.avatar} alt={person.name} />
                      <AvatarFallback className="text-[10px]">{person.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-xs">{person.name}</div>
                      {person.username && (
                        <div className="truncate text-[10px] text-muted-foreground">@{person.username}</div>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-4 text-center text-muted-foreground text-xs">
                  未找到匹配的人员
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
