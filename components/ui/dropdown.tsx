import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onValueChange: (value: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onValueChange,
  icon: Icon,
  placeholder = '请选择',
  className = '',
}: DropdownProps) {
  const selectedOption = options.find((option) => option.value === value);
  const displayText = selectedOption?.label || placeholder;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors ${className}`}
        >
          {Icon && <Icon className="h-4 w-4" />}
          <span>{displayText}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[140px] max-h-[300px] overflow-y-auto bg-white rounded-md border border-neutral-200 shadow-lg p-1 z-[10300]"
          sideOffset={5}
          align="start"
          avoidCollisions={true}
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className="flex items-center px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 rounded cursor-pointer outline-none"
              onSelect={() => onValueChange(option.value)}
            >
              {value === option.value && <Check className="h-4 w-4 mr-2 text-green-600" />}
              {value !== option.value && <span className="w-4 h-4 mr-2" />}
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}