import { useState, useEffect, useRef } from 'react';
import { FolderKanban, X, Plus, Loader2, Tag, Check, Search } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';

interface ProjectInfo {
  name: string;
  color: string;
}

interface ProjectSearchResult {
  id: number;
  type: string;
  phid: string;
  fields: {
    name: string;
    slug: string;
    color?: {
      key: string;
    };
  };
}

interface ProjectTagManagerProps {
  projects: string[];
  projectCache: Record<string, ProjectInfo>;
  onAdd: (phid: string) => Promise<void>;
  onRemove: (phid: string) => Promise<void>;
  isLoading?: boolean;
}

export function ProjectTagManager({
  projects,
  projectCache,
  onAdd,
  onRemove,
  isLoading = false,
}: ProjectTagManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [searchResults, setSearchResults] = useState<ProjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProjects = async () => {
      const query = inputValue.trim();
      if (!query) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await httpClient<{ data: ProjectSearchResult[] }>(
          `/api/projects/search?query=${encodeURIComponent(query)}&limit=10`
        );
        setSearchResults(response.data || []);
        setShowDropdown(response.data.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchProjects, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleAdd = async (phid?: string) => {
    const targetPhid = phid || inputValue.trim();
    if (!targetPhid || isAdding) return;

    setIsAdding(true);
    try {
      await onAdd(targetPhid);
      setInputValue('');
      setShowInput(false);
      setShowDropdown(false);
      setSearchResults([]);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectProject = (project: ProjectSearchResult) => {
    handleAdd(project.phid);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        handleSelectProject(searchResults[selectedIndex]);
      } else if (inputValue.trim().startsWith('PHID-')) {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue('');
      setShowDropdown(false);
      setSearchResults([]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <FolderKanban className="h-3.5 w-3.5 text-neutral-500" />
      <span className="text-xs text-neutral-600 font-medium min-w-[60px]">项目标签:</span>
      
      {/* Project List */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {projects.map((phid) => {
          const project = projectCache[phid];
          return (
            <div
              key={phid}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[11px]"
            >
              <Tag className="h-2.5 w-2.5" />
              <span>{project?.name || phid.slice(-6)}</span>
              <button
                onClick={() => onRemove(phid)}
                className="ml-0.5 p-0.5 hover:bg-purple-200 rounded transition-colors"
                title="移除项目标签"
                disabled={isLoading}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
        
        {/* Add Button or Input */}
        {showInput ? (
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-1">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="搜索项目名称或输入 PHID"
                  className="text-[11px] px-1.5 py-0.5 pr-6 border border-purple-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 w-48"
                  disabled={isAdding || isLoading}
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-purple-500 animate-spin" />
                )}
              </div>
              <button
                onClick={() => handleAdd()}
                disabled={isAdding || isLoading || !inputValue.trim()}
                className="p-0.5 text-purple-600 hover:bg-purple-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="确认添加"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  setShowInput(false);
                  setInputValue('');
                  setShowDropdown(false);
                  setSearchResults([]);
                }}
                className="p-0.5 text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
                title="取消"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Autocomplete Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-neutral-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((project, index) => (
                  <button
                    key={project.phid}
                    onClick={() => handleSelectProject(project)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-purple-50 transition-colors flex items-center gap-2 ${
                      index === selectedIndex ? 'bg-purple-50' : ''
                    }`}
                  >
                    <Tag className="h-3 w-3 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-900 truncate">
                        {project.fields.name}
                      </div>
                      <div className="text-neutral-500 text-[10px] truncate">
                        {project.fields.slug}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
            title="添加项目标签"
          >
            <Plus className="h-3 w-3" />
            <span>添加</span>
          </button>
        )}
      </div>
    </div>
  );
}
