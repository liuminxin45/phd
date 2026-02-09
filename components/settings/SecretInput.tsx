import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { INPUT_CLASS, DISABLED_CLASS } from '@/lib/settings/styles';

interface SecretInputProps {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SecretInput({ value, onChange, placeholder, disabled, className }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={!onChange}
        className={`pr-9 ${className || INPUT_CLASS} ${disabled ? DISABLED_CLASS : ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
        tabIndex={-1}
        title={visible ? '隐藏' : '显示'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
