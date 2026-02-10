import { Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-sm font-medium text-muted-foreground min-w-[90px]">{label}:</span>
        <div className="flex-1">
          {user ? (
            <Badge variant="secondary" className={cn("gap-1.5 py-0.5 pl-1 pr-2 font-normal", colorClass)}>
              <Avatar className="h-4 w-4">
                <AvatarImage src={user.image || undefined} alt={user.realName || user.userName} />
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                  {user.realName?.charAt(0) || user.userName?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{user.realName || user.userName}</span>
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground/50">未设置</span>
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
        <Briefcase className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">角色 ({totalRoles})</h4>
      </div>

      {/* Single Role Assignments */}
      {renderRoleItem('项目负责人', projectManager, 'bg-purple-50 text-purple-700 hover:bg-purple-100/80 border-purple-200')}
      {renderRoleItem('产品负责人', productManager, 'bg-blue-50 text-blue-700 hover:bg-blue-100/80 border-blue-200')}
      {renderRoleItem('助理', assistant, 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 border-amber-200')}

      {/* Developers - Multiple */}
      <div className="flex items-start gap-2 py-1.5">
        <span className="text-sm font-medium text-muted-foreground min-w-[90px] pt-1">开发工程师:</span>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            {developers.map((phid) => {
              const user = userCache[phid];
              return (
                <Badge
                  key={phid}
                  variant="secondary"
                  className="gap-1.5 py-0.5 pl-1 pr-2 font-normal bg-green-50 text-green-700 hover:bg-green-100/80 border-green-200"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={user?.image || undefined} alt={user?.realName || user?.userName} />
                    <AvatarFallback className="text-[9px] bg-green-200 text-green-800">
                      {user?.realName?.charAt(0) || user?.userName?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{user?.realName || user?.userName || phid.slice(-6)}</span>
                </Badge>
              );
            })}
            {developers.length === 0 && (
              <span className="text-xs text-muted-foreground/50 pt-1">未设置</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
