import type { AnalysisStage, AIFinalOutput } from '../../lib/ai/types';
import { cn } from '../../lib/utils';
import { CheckCircle2, Loader2, Circle, XCircle, ChevronRight } from 'lucide-react';

interface StepChainProps {
  stages: AnalysisStage[];
  className?: string;
}

const STAGE_LABELS: Record<string, string> = {
  nutrition: '饮食分析',
  fitness: '健身分析',
  study: '学习分析',
  scheduler: '综合安排',
  validator: '校验评分',
  formatter: '格式整理',
};

export function StepChain({ stages, className }: StepChainProps) {
  return (
    <div className={cn('flex items-center gap-1 flex-wrap text-xs', className)}>
      {stages.map((stage, i) => {
        const isLast = i === stages.length - 1;
        const icon = stage.status === 'completed' ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : stage.status === 'running' ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
        ) : stage.status === 'failed' ? (
          <XCircle className="w-3.5 h-3.5 text-red-500" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
        );

        return (
          <div key={stage.agent} className="flex items-center gap-1">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full border',
              stage.status === 'completed' && 'border-emerald-300 bg-emerald-50 text-emerald-700',
              stage.status === 'running' && 'border-blue-300 bg-blue-50 text-blue-700',
              stage.status === 'failed' && 'border-red-300 bg-red-50 text-red-700',
              stage.status === 'pending' && 'border-gray-200 text-muted-foreground',
            )}>
              {icon}
              <span>{STAGE_LABELS[stage.agent] || stage.agent}</span>
            </div>
            {!isLast && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
          </div>
        );
      })}
    </div>
  );
}
