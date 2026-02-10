import { useState } from 'react';
import { Search, Layers, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
  className?: string;
}

export function NodePoolPicker({ 
  value, 
  onChange, 
  items, 
  isLoading, 
  placeholder = '选择节点池节点...',
  className 
}: NodePoolPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = items.find(item => item.phid === value);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectItem = (item: NodePoolItem) => {
    onChange(item.phid);
    setSearchQuery('');
    setOpen(false);
  };

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedItem ? (
              <>
                <Layers className="h-4 w-4 shrink-0 opacity-50" />
                <span className="truncate">{selectedItem.name}</span>
              </>
            ) : (
              <span>{isLoading ? '加载中...' : placeholder}</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索节点..."
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
        
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <button
                key={item.phid}
                onClick={() => handleSelectItem(item)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-left",
                  value === item.phid && "bg-accent text-accent-foreground"
                )}
              >
                <div className={cn("h-6 w-6 rounded flex items-center justify-center shrink-0 text-xs", getColorClass(index))}>
                  <Layers className="h-3 w-3" />
                </div>
                <span className="flex-1 truncate">{item.name}</span>
                {value === item.phid && (
                  <Check className="h-4 w-4 shrink-0 opacity-50" />
                )}
              </button>
            ))
          ) : (
            <div className="py-4 text-center text-muted-foreground text-xs">
              {searchQuery ? '未找到匹配的节点' : '没有可用节点'}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
