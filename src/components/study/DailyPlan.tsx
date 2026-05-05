import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { db, type DailyPlan, type Task } from '../../lib/db';
import { STUDY_SCHEDULE } from '../../data/presets';
import { useTimer, formatDuration } from '../../hooks/useTimer';
import dayjs from 'dayjs';
import { Play, Pause, Square, RotateCcw, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

function TaskTimer({ task, onUpdate }: { task: Task; onUpdate: (t: Task) => void }) {
  const { isRunning, isPaused, elapsedSeconds, start, pause, resume, stop, reset } = useTimer();
  const [showTimer, setShowTimer] = useState(false);

  const handleStop = () => {
    const secs = stop();
    onUpdate({ ...task, actualMinutes: Math.round(secs / 60) });
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      {!showTimer ? (
        <Button variant="ghost" size="sm" onClick={() => setShowTimer(true)}>
          <Clock className="w-4 h-4 mr-1" /> 计时
        </Button>
      ) : (
        <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1">
          <span className="text-sm font-mono w-16 text-center">{formatDuration(elapsedSeconds)}</span>
          {!isRunning && !isPaused && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={start}><Play className="w-3 h-3" /></Button>}
          {isRunning && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={pause}><Pause className="w-3 h-3" /></Button>}
          {isPaused && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resume}><Play className="w-3 h-3" /></Button>}
          {(isRunning || isPaused) && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleStop}><Square className="w-3 h-3" /></Button>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset}><RotateCcw className="w-3 h-3" /></Button>
        </div>
      )}
      <Input
        type="number"
        placeholder="耗时(min)"
        className="w-24 h-8 text-sm"
        value={task.actualMinutes || ''}
        onChange={e => onUpdate({ ...task, actualMinutes: parseInt(e.target.value) || 0 })}
      />
    </div>
  );
}

export default function DailyPlanPage() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [saved, setSaved] = useState(false);

  const loadPlan = useCallback(async () => {
    const existing = await db.dailyPlans.where('date').equals(date).first();
    const schedule = STUDY_SCHEDULE.find(s => s.date === date);
    if (existing) {
      setPlan(existing);
    } else if (schedule) {
      const tasks: Task[] = schedule.tasks.map((t, i) => ({
        id: `${date}-${i}`,
        text: t,
        category: 'study',
        status: 'pending',
        plannedMinutes: 30,
        actualMinutes: 0,
        timerAccumulated: 0,
      }));
      setPlan({ date, tasks, conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 });
    } else {
      setPlan({ date, tasks: [], conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 });
    }
  }, [date]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const updateTask = (idx: number, task: Task) => {
    if (!plan) return;
    const tasks = [...plan.tasks];
    tasks[idx] = task;
    const totalFocus = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0);
    setPlan({ ...plan, tasks, totalFocusMinutes: totalFocus });
  };

  const save = async () => {
    if (!plan) return;
    await db.dailyPlans.put(plan);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTask = () => {
    if (!plan) return;
    const newTask: Task = {
      id: `${date}-${plan.tasks.length}`,
      text: '',
      category: 'study',
      status: 'pending',
      plannedMinutes: 30,
      actualMinutes: 0,
      timerAccumulated: 0,
    };
    setPlan({ ...plan, tasks: [...plan.tasks, newTask] });
  };

  const removeTask = (idx: number) => {
    if (!plan) return;
    const tasks = plan.tasks.filter((_, i) => i !== idx);
    setPlan({ ...plan, tasks });
  };

  const doneCount = plan?.tasks.filter(t => t.status === 'completed').length || 0;
  const totalCount = plan?.tasks.length || 0;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setDate(d => dayjs(d).subtract(1, 'day').format('YYYY-MM-DD'))}><ChevronLeft className="w-4 h-4" /></Button>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}>今天</Button>
        <Button variant="outline" size="sm" onClick={() => setDate(d => dayjs(d).add(1, 'day').format('YYYY-MM-DD'))}><ChevronRight className="w-4 h-4" /></Button>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            每日结果计划表
            <Badge variant={doneCount === totalCount && totalCount > 0 ? 'default' : 'secondary'}>
              {doneCount}/{totalCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={doneCount} max={totalCount || 1} />

          {plan?.tasks.map((task, idx) => (
            <div key={task.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={e => updateTask(idx, { ...task, status: e.target.checked ? 'completed' : 'pending' })}
                  className="mt-2 w-5 h-5 accent-primary"
                />
                <div className="flex-1 space-y-2">
                  <Input
                    value={task.text}
                    onChange={e => updateTask(idx, { ...task, text: e.target.value })}
                    placeholder={`任务 ${idx + 1}`}
                    className={task.status === 'completed' ? 'line-through opacity-60' : ''}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={task.status}
                      onChange={e => updateTask(idx, { ...task, status: e.target.value as any })}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="pending">⬜ 待做</option>
                      <option value="doing">🔥 进行中</option>
                      <option value="completed">✅ 完成</option>
                      <option value="failed">❌ 未完成</option>
                    </select>
                    <TaskTimer task={task} onUpdate={t => updateTask(idx, t)} />
                    <Input
                      placeholder="原因 (未完成时)"
                      className="flex-1 min-w-[120px] h-8 text-sm"
                      value={task.status === 'failed' ? (plan.completion || '') : ''}
                      onChange={() => {}}
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTask(idx)}>✕</Button>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addTask} className="w-full">+ 添加任务</Button>

          <Textarea
            placeholder="完成✅+耗时 & 未完成❌+耗时+原因"
            value={plan?.completion || ''}
            onChange={e => plan && setPlan({ ...plan, completion: e.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">今日战果复盘</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">攻克（今天具体学会了什么？）</label>
            <Textarea value={plan?.conquered || ''} onChange={e => plan && setPlan({ ...plan, conquered: e.target.value })} placeholder="具体、可检验的成果" />
          </div>
          <div>
            <label className="text-sm font-medium">难点（哪个知识点卡住了？）</label>
            <Textarea value={plan?.difficulty || ''} onChange={e => plan && setPlan({ ...plan, difficulty: e.target.value })} placeholder="卡住的点 + 卡了多久" />
          </div>
          <div>
            <label className="text-sm font-medium">调整（明天减少/增加任务量，还是改变方法？）</label>
            <Textarea value={plan?.adjust || ''} onChange={e => plan && setPlan({ ...plan, adjust: e.target.value })} placeholder="具体的调整方案" />
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        今日总专注时长: <span className="font-semibold text-foreground">{plan?.totalFocusMinutes || 0} 分钟</span>
      </div>
    </div>
  );
}
