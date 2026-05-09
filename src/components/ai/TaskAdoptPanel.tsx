import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { AIFinalOutput, ScheduledTask, FitnessSuggestion } from '../../lib/ai/types';
import dayjs from 'dayjs';
import { getDailyPlan, saveDailyPlan, saveExtraTraining } from '../../lib/db';
import { CheckSquare, X, Plus, Send, AlertTriangle } from 'lucide-react';

interface TaskAdoptProps {
  output: AIFinalOutput;
  onClose?: () => void;
}

export function TaskAdoptPanel({ output, onClose }: TaskAdoptProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(
    new Set(output.schedule.dailyTasks.map((_, i) => i))
  );
  const [selectedFitness, setSelectedFitness] = useState<Set<number>>(
    new Set(output.schedule.fitnessTasks.map((_, i) => i))
  );
  const [editedTasks, setEditedTasks] = useState(output.schedule.dailyTasks.map(function(t) { return { ...t }; }));
  const [editedFitness, setEditedFitness] = useState(output.schedule.fitnessTasks.map(function(t) { return { ...t }; }));
  const [adopted, setAdopted] = useState(false);

  const toggleTask = function (i: number) {
    const next = new Set(selectedTasks);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedTasks(next);
  };

  const toggleFitness = function (i: number) {
    const next = new Set(selectedFitness);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedFitness(next);
  };

  const updateTask = function (i: number, field: keyof ScheduledTask, val: string | number) {
    setEditedTasks(function (prev) { return prev.map(function (t, idx) { return idx === i ? { ...t, [field]: val } : t; }); });
  };

  const removeTask = function (i: number) {
    setEditedTasks(function (prev) { return prev.filter(function (_, idx) { return idx !== i; }); });
    const next = new Set(selectedTasks);
    next.delete(i);
    setSelectedTasks(next);
  };

  const addCustomTask = function () {
    const newTask: ScheduledTask = { name: '', category: 'other', plannedMinutes: 30, priority: 'medium', reason: '手动添加' };
    setEditedTasks(function (prev) { return [...prev, newTask]; });
    setSelectedTasks(function (prev) { return new Set([...prev, editedTasks.length]); });
  };

  const handleAdopt = async function () {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');

    const tasksToAdopt = editedTasks
      .filter(function (_, i) { return selectedTasks.has(i); })
      .filter(function (t) { return t.name.trim() && t.plannedMinutes > 0; });

    if (tasksToAdopt.length > 0) {
      const existing = await getDailyPlan(tomorrow);
      const newTasks = tasksToAdopt.map(function (t) {
        return {
          id: 'ai-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          text: t.name,
          category: t.category,
          status: 'pending' as const,
          plannedMinutes: t.plannedMinutes,
          actualMinutes: 0,
          timerAccumulated: 0,
        };
      });
      if (existing) {
        await saveDailyPlan({ ...existing, tasks: [...existing.tasks, ...newTasks] });
      } else {
        await saveDailyPlan({ date: tomorrow, tasks: newTasks, conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 });
      }
    }

    const fitnessToAdopt = editedFitness
      .filter(function (_, i) { return selectedFitness.has(i); })
      .filter(function (t) { return t.name.trim(); });

    for (const ft of fitnessToAdopt) {
      await saveExtraTraining({
        date: tomorrow,
        name: ft.name,
        type: ft.type as any,
        calories: ft.calories,
      });
    }

    setAdopted(true);
    setTimeout(function () { setAdopted(false); onClose?.(); }, 2000);
  };

  const selectedCount = selectedTasks.size + selectedFitness.size;
  const tomorrowLabel = dayjs().add(1, 'day').format('M/D');

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          <span>安排到明日 ({tomorrowLabel})</span>
          <span className="text-xs text-muted-foreground ml-auto">{selectedCount} 项已选</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {editedTasks.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">学习任务</div>
            <div className="space-y-1">
              {editedTasks.map(function (task, i) {
                return (
                  <label key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer text-sm group">
                    <input type="checkbox" checked={selectedTasks.has(i)} onChange={function () { toggleTask(i); }} className="shrink-0" />
                    <Input
                      value={task.name}
                      onChange={function (e) { updateTask(i, 'name', e.target.value); }}
                      className="flex-1 h-7 text-sm border-0 bg-transparent px-0 focus-visible:ring-0"
                      placeholder="任务名"
                    />
                    <select
                      value={task.category}
                      onChange={function (e) { updateTask(i, 'category', e.target.value); }}
                      className="h-7 text-xs rounded border px-1 shrink-0"
                    >
                      <option value="english">英语</option>
                      <option value="dental">专业课</option>
                      <option value="other">其它</option>
                    </select>
                    <Input
                      type="number"
                      value={task.plannedMinutes || ''}
                      onChange={function (e) { updateTask(i, 'plannedMinutes', parseInt(e.target.value) || 0); }}
                      className="w-16 h-7 text-xs shrink-0"
                      placeholder="min"
                    />
                    <span className="text-[10px] text-muted-foreground shrink-0">{task.priority === 'high' ? '高' : task.priority === 'low' ? '低' : '中'}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive shrink-0 opacity-0 group-hover:opacity-100" onClick={function () { removeTask(i); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {editedFitness.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">健身/加练</div>
            <div className="space-y-1">
              {editedFitness.map(function (ft, i) {
                return (
                  <label key={i} className="flex items-center gap-2 p-2 border rounded-lg bg-background hover:bg-muted/50 cursor-pointer text-sm">
                    <input type="checkbox" checked={selectedFitness.has(i)} onChange={function () { toggleFitness(i); }} className="shrink-0" />
                    <span className="flex-1">{ft.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">{ft.type}</span>
                    <span className="text-xs text-orange-600 shrink-0">{ft.calories} kcal</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Warnings / Discard Suggestions */}
        {output.warnings.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-1 font-medium text-amber-700 mb-1">
              <AlertTriangle className="w-3 h-3" /> 分析与建议取舍
            </div>
            {output.warnings.map(function (w, i) { return <div key={i} className="text-amber-600">• {w}</div>; })}
            {output.score < 80 && (
              <div className="mt-1 text-red-600">⚠ 本次分析评分较低({output.score})，建议人工审核后再安排</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={addCustomTask}>
            <Plus className="w-3 h-3 mr-1" />添加
          </Button>
          <Button onClick={handleAdopt} disabled={selectedCount === 0 || adopted} className="ml-auto">
            {adopted ? (
              <><CheckSquare className="w-4 h-4 mr-1" />已安排</>
            ) : (
              <><Send className="w-4 h-4 mr-1" />一键安排 ({selectedCount}项)</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
