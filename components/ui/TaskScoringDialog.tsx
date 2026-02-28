import { useState, useEffect } from 'react';
import { X, Award, Sparkles, Check } from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TaskScoringDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { workClass: string; workScore: string; completeRate: string }) => void;
  currentValues?: {
    workClass?: string;
    workScore?: string;
    completeRate?: string;
  };
  autoMappedWorkClass?: string; // Auto-mapped work class from estimated-days for first-time scoring
  isScored?: boolean;
}

const WORK_CLASSES = [
  '5档，例：极简物料选用、自测等',
  '10档，例：简单的物料评估、开发指导、模块维护等',
  '20档，例：简单问题修复、经验总结、普通模块维护等',
  '30档，例：普通物料选用、经验总结等',
  '40档，例：简单讲证、产品级自测等',
  '50档，例：简单模块开发、复杂物料选用/评估，功能调研等',
  '60档，例：普通模块开发、复杂的技术积累、模块维护等',
  '80档，例：复杂模块移植，高级课程讲座等',
  '100档，例：普通模块设计、课程设计、专利申请等',
  '150档，例：局部架构级维护，设计新模块的测试方法等',
  '200档，例：复杂模块开发，新产义复杂的技术/流程规范，有才奖等',
  '300档，例：新产品的完整调研，新模块的设计，高级课程设计等',
  '400档，例：复杂模块设计，复杂功能的引入等',
  '500档，例：技术攻关，新方案开发等',
  '600档，例：部分产品级完整设计，系列产品引入等',
  '800档，例：平台架构设计、主体实现等',
  '1000档，例：全新形态产品开发等'
];
const WORK_SCORES = [
  '0分：质量差',
  '5分：有明显延期',
  '6分：有稍微延期',
  '7分：按期标准完成',
  '8分：总结较好',
  '9分：总结完善',
  '10分：过程记录详尽,超额期完成',
  '-10分：重大质量事故'
];

// Helper function to extract档位 number from work class string
const extractWorkClassValue = (displayText: string): string => {
  // Extract number from "5档，例：..." format
  const match = displayText.match(/^(\d+)档/);
  return match ? match[1] : displayText;
};

// Helper function to extract score number from work score string
const extractWorkScoreValue = (displayText: string): string => {
  // Extract number from "5分：..." or "-10分：..." format
  const match = displayText.match(/^(-?\d+)分/);
  return match ? match[1] : displayText;
};

// Reverse conversion: find display text from stored value
const findWorkClassDisplay = (value: string): string => {
  if (!value) return '';
  // Find the option that starts with this number
  return WORK_CLASSES.find(cls => cls.startsWith(value + '档')) || '';
};

const findWorkScoreDisplay = (value: string): string => {
  if (!value) return '';
  // Find the option that starts with this number
  return WORK_SCORES.find(score => score.startsWith(value + '分')) || '';
};

// Helper function to map workload (estimated-days) to work class
const mapWorkloadToWorkClass = (workload: string): string => {
  if (!workload) return '';
  // Extract number from workload string (e.g., "1.5d" -> 1.5, "20d" -> 20, "0.5天" -> 0.5)
  const match = workload.match(/([\d.]+)/);
  if (!match) return '';
  
  const days = parseFloat(match[1]);
  if (isNaN(days)) return '';
  
  // Remove decimal point: 1.5d -> 10档, 0.5d -> 5档, 20d -> 20档
  const level = Math.floor(days * 10);
  
  // Find the closest available档位
  const availableLevels = [5, 10, 20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500, 600, 800, 1000];
  
  // Find the closest档位 that is >= calculated档位
  let closestLevel = availableLevels.find(d => d >= level);
  
  // If no档位 is large enough, use the largest one
  if (!closestLevel) {
    closestLevel = availableLevels[availableLevels.length - 1];
  }
  
  return String(closestLevel);
};

export function TaskScoringDialog({ isOpen, onClose, onConfirm, currentValues, autoMappedWorkClass, isScored }: TaskScoringDialogProps) {
  const [workClass, setWorkClass] = useState(currentValues?.workClass || '');
  const [workScore, setWorkScore] = useState(currentValues?.workScore || '');
  const [recommendedWorkClass, setRecommendedWorkClass] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isScored) {
        // Already-scored tasks: show actual saved values
        setWorkClass(findWorkClassDisplay(currentValues?.workClass || '') || '');
        setWorkScore(findWorkScoreDisplay(currentValues?.workScore || '') || '');
        setRecommendedWorkClass('');
      } else {
        // First-time scoring: do NOT preselect; show recommendation
        setWorkClass('');
        setWorkScore('');
        // Map workload to work class档位
        const mappedLevel = autoMappedWorkClass ? mapWorkloadToWorkClass(autoMappedWorkClass) : '';
        const displayText = mappedLevel ? findWorkClassDisplay(mappedLevel) : '';
        setRecommendedWorkClass(displayText);
      }
    }
  }, [isOpen, isScored, autoMappedWorkClass, currentValues]);

  const handleConfirm = () => {
    if (!workClass || !workScore) {
      return;
    }
    // Extract the actual values that Phabricator expects
    const actualWorkClass = extractWorkClassValue(workClass);
    const actualWorkScore = extractWorkScoreValue(workScore);
    const actualCompleteRate = '1';
    
    onConfirm({ 
      workClass: actualWorkClass, 
      workScore: actualWorkScore, 
      completeRate: actualCompleteRate 
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-lg p-0 border-border/40 shadow-2xl overflow-hidden z-[10300] bg-card gap-0"
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
        }}
        onPointerDownOutside={(event) => {
          event.stopPropagation();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>任务评分</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 md:p-8 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-500 flex-shrink-0">
                <Award className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">任务评分</h2>
                <p className="text-sm text-muted-foreground">对任务的复杂度与完成质量进行评估</p>
              </div>
            </div>
            {/* Close button is handled by DialogContent's default X or we can keep this custom one if we hide the default */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground/50 hover:text-foreground -mr-2 -mt-2 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Recommendation Card */}
            {recommendedWorkClass && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI 智能推荐
                    </div>
                    <div className="text-sm text-foreground/90">
                      基于工时估算，建议定级 <span className="font-semibold text-primary">{recommendedWorkClass.split('，')[0]}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setWorkClass(recommendedWorkClass);
                      setWorkScore('7分：按期标准完成');
                      toast.success('已采用推荐评分');
                    }}
                    className="h-8 text-xs font-medium bg-background/80 hover:bg-background shadow-sm border-transparent hover:border-primary/20 transition-all"
                  >
                    一键采纳
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Work Class Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">任务复杂度定级</label>
                <Select
                  value={extractWorkClassValue(workClass)}
                  onValueChange={(value) => {
                    const displayText = findWorkClassDisplay(value);
                    setWorkClass(displayText);
                  }}
                >
                  <SelectTrigger className="w-full h-11 bg-muted/30 hover:bg-muted/50 border-transparent hover:border-border/50 focus:ring-1 focus:ring-primary/20 rounded-lg transition-all">
                    <SelectValue placeholder="选择任务分类..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] p-1 z-[10310]">
                    {WORK_CLASSES.map(cls => (
                      <SelectItem 
                        key={extractWorkClassValue(cls)} 
                        value={extractWorkClassValue(cls)} 
                        textValue={`${extractWorkClassValue(cls)}档 ${cls.split('，')[1] ? `- ${cls.split('，')[1]}` : ''}`}
                        className="py-2.5 px-3 rounded-md focus:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">{extractWorkClassValue(cls)}档</span>
                          <span className="text-xs text-muted-foreground line-clamp-1 opacity-70">{cls.split('，')[1] || cls}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work Score Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">完成质量评分</label>
                <Select
                  value={extractWorkScoreValue(workScore)}
                  onValueChange={(value) => {
                    const displayText = findWorkScoreDisplay(value);
                    setWorkScore(displayText);
                  }}
                >
                  <SelectTrigger className="w-full h-11 bg-muted/30 hover:bg-muted/50 border-transparent hover:border-border/50 focus:ring-1 focus:ring-primary/20 rounded-lg transition-all">
                    <SelectValue placeholder="选择质量评分..." />
                  </SelectTrigger>
                  <SelectContent className="p-1 z-[10310]">
                    {WORK_SCORES.map(score => (
                      <SelectItem 
                        key={extractWorkScoreValue(score)} 
                        value={extractWorkScoreValue(score)} 
                        textValue={score}
                        className="py-2.5 px-3 rounded-md focus:bg-muted/50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium text-sm w-12 text-right",
                            score.startsWith('-') ? "text-destructive" : "text-foreground"
                          )}>
                            {extractWorkScoreValue(score)}分
                          </span>
                          <span className="text-xs text-muted-foreground">{score.split('：')[1]}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg"
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (!workClass || !workScore) {
                  toast.error('请完整填写任务分类和工作质量评分');
                  return;
                }
                handleConfirm();
                const actualWorkClass = extractWorkClassValue(workClass);
                const actualWorkScore = extractWorkScoreValue(workScore);
                toast.success(`评分已保存`, {
                  description: `总分: ${Number(actualWorkClass) + Number(actualWorkScore)}分`
                });
              }}
              className="flex-[2] h-11 rounded-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-primary-foreground font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={!workClass || !workScore}
            >
              <Check className="w-4 h-4 mr-2" />
              确认评分
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
