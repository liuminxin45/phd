import { Check, AlertCircle, Info } from 'lucide-react';
import type { StatusType } from '@/lib/settings/types';

const STYLE_MAP: Record<StatusType, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

const ICON_MAP: Record<StatusType, React.ReactNode> = {
  success: <Check className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

export function StatusMessage({ message, type }: { message: string; type: StatusType }) {
  if (!message) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg ${STYLE_MAP[type]}`}>
      {ICON_MAP[type]}
      {message}
    </div>
  );
}
