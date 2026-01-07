import { Briefcase } from 'lucide-react';

interface UserInfo {
  realName: string;
  userName: string;
  image: string | null;
}

interface RoleManagerProps {
  projectManager: string | null;
  productManager: string | null;
  developers: string[];
  assistant: string | null;
  userCache: Record<string, UserInfo>;
}

export function RoleManager({
  projectManager,
  productManager,
  developers,
  assistant,
  userCache,
}: RoleManagerProps) {

  const renderRoleItem = (
    label: string,
    phid: string | null,
    colorClass: string
  ) => {
    const user = phid ? userCache[phid] : null;

    return (
      <div className="flex items-start gap-2 py-2">
        <span className="text-sm font-medium text-neutral-700 min-w-[100px]">{label}:</span>
        <div className="flex-1">
          {user ? (
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${colorClass} rounded text-[11px]`}>
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.realName || user.userName}
                  className="h-3.5 w-3.5 rounded-full"
                />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-semibold">
                  {user.realName?.charAt(0) || user.userName?.charAt(0) || '?'}
                </div>
              )}
              <span>{user.realName || user.userName}</span>
            </div>
          ) : (
            <span className="text-sm text-neutral-500">未设置</span>
          )}
        </div>
      </div>
    );
  };

  const totalRoles = [
    projectManager,
    productManager,
    assistant,
    ...developers
  ].filter(Boolean).length;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="h-4 w-4 text-neutral-600" />
        <h4 className="text-sm font-semibold text-neutral-900">角色 ({totalRoles})</h4>
      </div>

      {/* Single Role Assignments */}
      {renderRoleItem('项目负责人', projectManager, 'bg-purple-50 text-purple-700')}
      {renderRoleItem('产品负责人', productManager, 'bg-blue-50 text-blue-700')}
      {renderRoleItem('助理', assistant, 'bg-amber-50 text-amber-700')}

      {/* Developers - Multiple */}
      <div className="flex items-start gap-2 py-2">
        <span className="text-sm font-medium text-neutral-700 min-w-[100px]">开发工程师:</span>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            {developers.map((phid) => {
              const user = userCache[phid];
              return (
                <div
                  key={phid}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[11px]"
                >
                  {user?.image ? (
                    <img
                      src={user.image}
                      alt={user.realName || user.userName}
                      className="h-3.5 w-3.5 rounded-full"
                    />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full bg-green-200 flex items-center justify-center text-[9px] font-semibold">
                      {user?.realName?.charAt(0) || user?.userName?.charAt(0) || '?'}
                    </div>
                  )}
                  <span>{user?.realName || user?.userName || phid.slice(-6)}</span>
                </div>
              );
            })}
            {developers.length === 0 && (
              <span className="text-sm text-neutral-500">未设置</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
