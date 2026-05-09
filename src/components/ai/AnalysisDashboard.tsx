import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { AIFinalOutput, AnalysisStage } from '../../lib/ai/types';
import { StepChain } from './StepChain';
import { TaskAdoptPanel } from './TaskAdoptPanel';
import { Apple, Dumbbell, Brain, Calendar, Target, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

interface AnalysisDashboardProps {
  stages: AnalysisStage[];
  finalResult: AIFinalOutput | null;
  isLoading: boolean;
  conversations: { role: 'user' | 'assistant'; content: string }[];
  onRetry?: () => void;
}

export function AnalysisDashboard({ stages, finalResult, isLoading, conversations, onRetry }: AnalysisDashboardProps) {
  const [showChat, setShowChat] = useState(false);

  return (
    <div className="space-y-4 animate-in">
      {/* Step Chain */}
      <Card>
        <CardContent className="py-3">
          <StepChain stages={stages} className="flex-wrap gap-y-2" />
          {isLoading && !finalResult && (
            <p className="text-xs text-muted-foreground mt-2 animate-pulse">
              正在分析中，请稍候... ({stages.filter(function(s) { return s.status === 'completed'; }).length}/{stages.length} 完成)
            </p>
          )}
          {finalResult && finalResult.score < 80 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              <span>校验评分 {finalResult.score}，未达标准 (阈值80)，结果可能不完整</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Cards */}
      {finalResult && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Nutrition Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Apple className="w-4 h-4 text-green-500" />
                  饮食诊断
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div><span className="text-muted-foreground">热量: </span>{finalResult.diagnosis.nutrition.calorieStatus || '--'}</div>
                <div><span className="text-muted-foreground">蛋白质: </span>{finalResult.diagnosis.nutrition.proteinAdequacy || '--'}</div>
                {finalResult.diagnosis.nutrition.issues.length > 0 && (
                  <div>
                    <div className="text-red-600 font-medium mt-1">问题:</div>
                    {finalResult.diagnosis.nutrition.issues.map(function (s, i) { return <div key={i} className="text-red-500">• {s}</div>; })}
                  </div>
                )}
                {finalResult.diagnosis.nutrition.suggestions.length > 0 && (
                  <div>
                    <div className="text-emerald-600 font-medium mt-1">建议:</div>
                    {finalResult.diagnosis.nutrition.suggestions.map(function (s, i) { return <div key={i} className="text-emerald-500">• {s}</div>; })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fitness Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-orange-500" />
                  健身进度
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div><span className="text-muted-foreground">状态: </span>{finalResult.diagnosis.fitness.progressStatus || '--'}</div>
                <div><span className="text-muted-foreground">容量: </span>{finalResult.diagnosis.fitness.volumeAnalysis || '--'}</div>
                {finalResult.diagnosis.fitness.suggestions.length > 0 && (
                  <div>
                    <div className="text-emerald-600 font-medium mt-1">建议:</div>
                    {finalResult.diagnosis.fitness.suggestions.map(function (s, i) { return <div key={i} className="text-emerald-500">• {s}</div>; })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Study Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-blue-500" />
                  学习效率
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div><span className="text-muted-foreground">效率分: </span>
                  <span className={cn('font-bold', finalResult.diagnosis.study.efficiencyScore >= 70 ? 'text-emerald-600' : finalResult.diagnosis.study.efficiencyScore >= 40 ? 'text-amber-600' : 'text-red-600')}>
                    {finalResult.diagnosis.study.efficiencyScore || 0}
                  </span>
                </div>
                {finalResult.diagnosis.study.bottlenecks.length > 0 && (
                  <div>
                    <div className="text-red-600 font-medium mt-1">瓶颈:</div>
                    {finalResult.diagnosis.study.bottlenecks.map(function (s, i) { return <div key={i} className="text-red-500">• {s}</div>; })}
                  </div>
                )}
                {finalResult.diagnosis.study.suggestions.length > 0 && (
                  <div>
                    <div className="text-emerald-600 font-medium mt-1">建议:</div>
                    {finalResult.diagnosis.study.suggestions.map(function (s, i) { return <div key={i} className="text-emerald-500">• {s}</div>; })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Schedule Cards */}
          {finalResult.schedule.dailyTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  明日安排 ({finalResult.schedule.dailyTasks.length}项)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {finalResult.schedule.dailyTasks.map(function (t, i) {
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px]', t.category === 'english' ? 'bg-blue-100 text-blue-700' : t.category === 'dental' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                          {t.category === 'english' ? '英语' : t.category === 'dental' ? '专业' : '其它'}
                        </span>
                        <span className="flex-1 truncate">{t.name}</span>
                        <span className="text-muted-foreground shrink-0">{t.plannedMinutes}min</span>
                        <span className="text-[10px] text-muted-foreground shrink-0" title={t.reason}>💡</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Weekly Plan Card (weekend only) */}
          {finalResult.schedule.weeklyPlan && (function () {
            const day = new Date().getDay();
            const isWeekend = day === 0 || day === 6;
            if (!isWeekend) return null;
            return (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-blue-500" />
                    下周计划
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1.5">
                  <div><span className="text-muted-foreground">目标: </span>{finalResult.schedule.weeklyPlan?.weeklyGoals || '--'}</div>
                  {finalResult.schedule.weeklyPlan?.focusAreas && finalResult.schedule.weeklyPlan.focusAreas.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">重点: </span>
                      {finalResult.schedule.weeklyPlan.focusAreas.map(function (a, i) { return <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded mr-1">{a}</span>; })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Warnings */}
          {finalResult.warnings.length > 0 && (
            <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <div>
                {finalResult.warnings.map(function (w, i) { return <div key={i}>• {w}</div>; })}
              </div>
            </div>
          )}

          {/* Task Adopt Panel */}
          {(finalResult.schedule.dailyTasks.length > 0 || finalResult.schedule.fitnessTasks.length > 0) && (
            <TaskAdoptPanel output={finalResult} />
          )}
        </>
      )}

      {/* Chat History (collapsed) */}
      {conversations.length > 0 && (
        <div className="border-t pt-2">
          <button
            onClick={function () { setShowChat(!showChat); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full py-1"
          >
            {showChat ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            AI对话记录 ({conversations.length}条)
          </button>
          {showChat && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {conversations.map(function (msg, i) {
                return (
                  <div key={i} className={cn('text-xs p-2 rounded', msg.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4')}>
                    <div className="markdown-body text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content.slice(0, 500)}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Retry */}
      {onRetry && !isLoading && (
        <div className="text-center">
          <button onClick={onRetry} className="text-xs text-muted-foreground hover:text-foreground underline">
            重新分析
          </button>
        </div>
      )}
    </div>
  );
}
