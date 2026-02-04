import { useState } from 'react';
import { Users, X, UserPlus } from 'lucide-react';
import { UserSearchInput } from '@/components/ui/UserSearchInput';

interface UserInfo {
  realName: string;
  userName: string;
  image: string | null;
}

interface AssigneeManagerProps {
  assignee: string | null;
  userCache: Record<string, UserInfo>;
  onAssign: (phid: string) => Promise<void>;
  onUnassign: () => Promise<void>;
  isLoading?: boolean;
}

export function AssigneeManager({
  assignee,
  userCache,
  onAssign,
  onUnassign,
  isLoading = false,
}: AssigneeManagerProps) {
  const [showInput, setShowInput] = useState(false);

  const handleAssign = async (phid: string) => {
    await onAssign(phid);
    setShowInput(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Users className="h-3.5 w-3.5 text-neutral-500" />
      <span className="text-xs text-neutral-600 font-medium min-w-[60px]">指派给:</span>
      
      <div className="flex flex-wrap gap-1.5 flex-1">
        {assignee ? (
          // Show current assignee
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[11px]">
            {userCache[assignee]?.image ? (
              <img
                src={userCache[assignee].image}
                alt={userCache[assignee].realName || userCache[assignee].userName}
                className="h-3.5 w-3.5 rounded-full"
              />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full bg-green-200 flex items-center justify-center text-[9px] font-semibold">
                {userCache[assignee]?.realName?.charAt(0) || 
                 userCache[assignee]?.userName?.charAt(0) || '?'}
              </div>
            )}
            <span>
              {userCache[assignee]?.realName || 
               userCache[assignee]?.userName || 
               assignee.slice(-6)}
            </span>
            <button
              onClick={onUnassign}
              className="ml-0.5 p-0.5 hover:bg-green-200 rounded transition-colors"
              title="取消指派"
              disabled={isLoading}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          // Show "未指派" or search input
          <>
            {showInput ? (
              <UserSearchInput
                onSelect={handleAssign}
                onCancel={() => setShowInput(false)}
                placeholder="输入用户名或 PHID"
                colorScheme="green"
                disabled={isLoading}
                maxResults={20}
              />
            ) : (
              <>
                <span className="text-[11px] text-neutral-400">未指派</span>
                <button
                  onClick={() => setShowInput(true)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                  title="指派任务"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>指派</span>
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
