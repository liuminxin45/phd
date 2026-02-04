import { useState } from 'react';
import { Users, X, UserPlus } from 'lucide-react';
import { UserSearchInput } from '@/components/ui/UserSearchInput';

interface UserInfo {
  realName: string;
  userName: string;
  image: string | null;
}

interface SubscriberManagerProps {
  subscribers: string[];
  userCache: Record<string, UserInfo>;
  onAdd: (phid: string) => Promise<void>;
  onRemove: (phid: string) => Promise<void>;
  isLoading?: boolean;
}

export function SubscriberManager({
  subscribers,
  userCache,
  onAdd,
  onRemove,
  isLoading = false,
}: SubscriberManagerProps) {
  const [showInput, setShowInput] = useState(false);

  const handleAdd = async (phid: string) => {
    await onAdd(phid);
    setShowInput(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Users className="h-3.5 w-3.5 text-neutral-500" />
      <span className="text-xs text-neutral-600 font-medium min-w-[60px]">订阅者:</span>
      
      {/* Subscriber List */}
      <div className="flex flex-wrap gap-1.5 flex-1">
        {subscribers.map((phid) => {
          const user = userCache[phid];
          return (
            <div
              key={phid}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px]"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.realName || user.userName}
                  className="h-3.5 w-3.5 rounded-full"
                />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-semibold">
                  {user?.realName?.charAt(0) || user?.userName?.charAt(0) || '?'}
                </div>
              )}
              <span>{user?.realName || user?.userName || phid.slice(-6)}</span>
              <button
                onClick={() => onRemove(phid)}
                className="ml-0.5 p-0.5 hover:bg-blue-200 rounded transition-colors"
                title="移除订阅者"
                disabled={isLoading}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
        
        {/* Add Button or Search Input */}
        {showInput ? (
          <UserSearchInput
            onSelect={handleAdd}
            onCancel={() => setShowInput(false)}
            placeholder="输入用户名或 PHID"
            colorScheme="blue"
            disabled={isLoading}
            maxResults={20}
          />
        ) : (
          <button
            onClick={() => setShowInput(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="添加订阅者"
          >
            <UserPlus className="h-3 w-3" />
            <span>添加</span>
          </button>
        )}
      </div>
    </div>
  );
}
