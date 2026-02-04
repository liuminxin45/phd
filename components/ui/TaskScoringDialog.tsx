import { useState, useEffect } from 'react';
import { X, Award } from 'lucide-react';
import { Dropdown } from './dropdown';
import { toast } from 'sonner';

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
const COMPLETE_RATES = ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];

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

// Helper function to convert percentage to decimal
const extractCompleteRateValue = (displayText: string): string => {
  // Convert "50%" to "0.5"
  const match = displayText.match(/^(\d+)%$/);
  if (match) {
    const percentage = parseInt(match[1], 10);
    return (percentage / 100).toString();
  }
  return displayText;
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

const findCompleteRateDisplay = (value: string): string => {
  if (!value) return '';
  // Convert decimal to percentage (e.g., "0.5" -> "50%")
  const decimal = parseFloat(value);
  if (!isNaN(decimal)) {
    const percentage = Math.round(decimal * 100);
    return `${percentage}%`;
  }
  return '';
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
  const [completeRate, setCompleteRate] = useState(currentValues?.completeRate || '');
  const [recommendedWorkClass, setRecommendedWorkClass] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isScored) {
        // Already-scored tasks: show actual saved values
        setWorkClass(findWorkClassDisplay(currentValues?.workClass || '') || '');
        setWorkScore(findWorkScoreDisplay(currentValues?.workScore || '') || '');
        setCompleteRate('100%');
        setRecommendedWorkClass('');
      } else {
        // First-time scoring: do NOT preselect; show recommendation
        setWorkClass('');
        setWorkScore('');
        setCompleteRate('100%');
        // Map workload to work class档位
        const mappedLevel = autoMappedWorkClass ? mapWorkloadToWorkClass(autoMappedWorkClass) : '';
        const displayText = mappedLevel ? findWorkClassDisplay(mappedLevel) : '';
        setRecommendedWorkClass(displayText);
      }
    }
  }, [isOpen, isScored, autoMappedWorkClass, currentValues]);

  if (!isOpen) return null;

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

  const isValid = workClass && workScore;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10300] pointer-events-auto" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-neutral-900">任务打分</h2>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Recommendation */}
            {recommendedWorkClass && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-blue-900 mb-2">推荐</div>
                    <div className="text-sm text-neutral-700">
                      <span className="font-medium">{recommendedWorkClass}</span>
                      <span className="text-neutral-500 mx-2">·</span>
                      <span className="font-medium">7分：按期标准完成</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setWorkClass(recommendedWorkClass);
                      setWorkScore('7分：按期标准完成');
                      toast.success('已采用推荐评分');
                    }}
                    className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    采用推荐
                  </button>
                </div>
              </div>
            )}

            {/* 任务分类 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-900">任务分类</label>
              <Dropdown
                options={WORK_CLASSES.map(cls => ({
                  value: extractWorkClassValue(cls),
                  label: cls
                }))}
                value={extractWorkClassValue(workClass)}
                onValueChange={(value) => {
                  const displayText = findWorkClassDisplay(value);
                  setWorkClass(displayText);
                }}
                placeholder="请选择任务分类"
              />
            </div>

            {/* 工作质量评分 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-900">工作质量评分</label>
              <Dropdown
                options={WORK_SCORES.map(score => ({
                  value: extractWorkScoreValue(score),
                  label: score
                }))}
                value={extractWorkScoreValue(workScore)}
                onValueChange={(value) => {
                  const displayText = findWorkScoreDisplay(value);
                  setWorkScore(displayText);
                }}
                placeholder="请选择工作质量评分"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                if (!workClass || !workScore) {
                  toast.error('请完整填写任务分类和工作质量评分');
                  return;
                }
                handleConfirm();
                const actualWorkClass = extractWorkClassValue(workClass);
                const actualWorkScore = extractWorkScoreValue(workScore);
                toast.success(`任务打分已保存，总分: ${Number(actualWorkClass) + Number(actualWorkScore)}分`);
              }}
              className="flex-1 px-4 py-2 bg-neutral-900 text-white text-sm rounded hover:bg-neutral-800 transition-colors"
            >
              保存评分
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 text-sm hover:bg-neutral-100 rounded transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
