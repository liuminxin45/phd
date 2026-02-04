import { useState, useRef, useEffect } from 'react';
import { Search, X, Briefcase } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color?: string;
}

interface ProjectPickerProps {
  selected: Project[];
  onAdd: (project: Project) => void;
  onRemove: (projectId: string) => void;
  maxSelections?: number;
  dropdownZIndex?: number;
}

// Mock project data
const mockProjects: Project[] = [
  { id: '1', name: '工业维护Utility 1.5', color: 'blue' },
  { id: '2', name: '数据分析平台', color: 'green' },
  { id: '3', name: 'Neo Dashboard', color: 'purple' },
  { id: '4', name: '用户认证系统', color: 'orange' },
  { id: '5', name: 'API Gateway', color: 'red' },
  { id: '6', name: '监控系统', color: 'yellow' },
  { id: '7', name: '日志服务', color: 'pink' },
];

export function ProjectPicker({ selected, onAdd, onRemove, maxSelections, dropdownZIndex = 50 }: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredProjects = mockProjects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selected.some((s) => s.id === project.id)
  );

  const handleAddProject = (project: Project) => {
    if (maxSelections && selected.length >= maxSelections) {
      return;
    }
    onAdd(project);
    setSearchQuery('');
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getColorClass = (color?: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      purple: 'bg-purple-100 text-purple-700',
      orange: 'bg-orange-100 text-orange-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      pink: 'bg-pink-100 text-pink-700',
    };
    return colors[color || 'blue'] || colors.blue;
  };

  return (
    <div className="flex-1 flex flex-wrap gap-1.5 items-center">
      {/* Selected Projects */}
      {selected.map((project) => (
        <div
          key={project.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${getColorClass(project.color)}`}
        >
          <Briefcase className="h-3 w-3" />
          <span>{project.name}</span>
          <button
            onClick={() => onRemove(project.id)}
            className="hover:bg-black/10 rounded p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Search Input */}
      {(!maxSelections || selected.length < maxSelections) && (
        <div className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="添加项目..."
              className="text-xs px-2 py-1 pr-6 border border-neutral-300 rounded focus:outline-none focus:border-blue-600 min-w-[120px]"
            />
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400" />
          </div>

          {/* Dropdown */}
          {isOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 mt-1 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              style={{ zIndex: dropdownZIndex }}
            >
              {filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleAddProject(project)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className={`h-6 w-6 rounded flex items-center justify-center ${getColorClass(project.color)}`}>
                      <Briefcase className="h-3 w-3" />
                    </div>
                    <span className="text-neutral-900">{project.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-neutral-500">
                  {searchQuery ? '未找到匹配的项目' : '没有可用项目'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
