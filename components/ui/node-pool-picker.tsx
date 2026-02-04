import { useState, useRef, useEffect } from 'react';
import { Search, Layers } from 'lucide-react';

interface NodePoolItem {
  id: number;
  phid: string;
  name: string;
}

interface NodePoolPickerProps {
  value: string; // PHID-IALL-xxx
  onChange: (phid: string) => void;
  items: NodePoolItem[];
  isLoading?: boolean;
  placeholder?: string;
}

export function NodePoolPicker({ value, onChange, items, isLoading, placeholder = '选择节点池节点...' }: NodePoolPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find(item => item.phid === value);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectItem = (item: NodePoolItem) => {
    onChange(item.phid);
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

  const getColorClass = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-green-100 text-green-700',
      'bg-purple-100 text-purple-700',
      'bg-orange-100 text-orange-700',
      'bg-red-100 text-red-700',
      'bg-yellow-100 text-yellow-700',
      'bg-pink-100 text-pink-700',
      'bg-indigo-100 text-indigo-700',
      'bg-teal-100 text-teal-700',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : (selectedItem?.name || '')}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setSearchQuery('');
            setIsOpen(true);
          }}
          placeholder={isLoading ? '加载中...' : placeholder}
          disabled={isLoading}
          className="w-full text-sm px-3 py-2 pr-8 border border-neutral-300 rounded focus:outline-none focus:border-blue-600"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
      </div>

      {/* Dropdown */}
      {isOpen && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-1 w-full bg-white border border-neutral-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <button
                key={item.phid}
                onClick={() => handleSelectItem(item)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-neutral-50 transition-colors text-left"
              >
                <div className={`h-6 w-6 rounded flex items-center justify-center ${getColorClass(index)}`}>
                  <Layers className="h-3 w-3" />
                </div>
                <span className="text-neutral-900">{item.name}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-neutral-500">
              {searchQuery ? '未找到匹配的节点' : '没有可用节点'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
