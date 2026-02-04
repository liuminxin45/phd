import { useState } from 'react';
import { Users, X, UserPlus } from 'lucide-react';
import { UserSearchInput } from '@/components/ui/UserSearchInput';

interface UserInfo {
  phid: string;
  realName: string;
  userName: string;
  image: string | null;
}

interface MemberManagerProps {
  members: UserInfo[];
  userCache: Record<string, UserInfo>;
  onAdd: (phid: string) => Promise<void>;
  onRemove: (phid: string) => Promise<void>;
  isLoading?: boolean;
}

export function MemberManager({
  members,
  userCache,
  onAdd,
  onRemove,
  isLoading = false,
}: MemberManagerProps) {
  const [showInput, setShowInput] = useState(false);

  const handleAdd = async (phid: string) => {
    await onAdd(phid);
    setShowInput(false);
  };

  return (
    <div className="border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">成员 ({members.length})</h3>
      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <div
            key={member.phid}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px]"
          >
            {member.image ? (
              <img
                src={member.image}
                alt={member.realName || member.userName}
                className="h-3.5 w-3.5 rounded-full"
              />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-semibold">
                {member.realName?.charAt(0) || member.userName?.charAt(0) || '?'}
              </div>
            )}
            <span>{member.realName || member.userName || member.phid.slice(-6)}</span>
            <button
              onClick={() => onRemove(member.phid)}
              className="ml-0.5 p-0.5 hover:bg-blue-200 rounded transition-colors"
              title="移除成员"
              disabled={isLoading}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        
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
            title="添加成员"
          >
            <UserPlus className="h-3 w-3" />
            <span>添加</span>
          </button>
        )}
      </div>
    </div>
  );
}
