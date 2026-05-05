import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getOrCreateProfile, getDailyPlansInRange, getFoodEntriesInRange, getWorkoutLogsInRange } from '../../lib/db';
import type { DailyPlan, WorkoutLog } from '../../types';
import dayjs from 'dayjs';

const TASK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let total = 0;
  for (const ex of w.exercises) {
    if (ex.kind === 'cardio' && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      let met = speed > 6 ? speed * 1.0 : speed * 0.5 + 2;
      met += incline * 0.5;
      total += met * weightKg * (duration / 60);
    } else if (ex.kind === 'strength') {
      const strengthCount = w.exercises.filter(e => e.kind === 'strength').length || 1;
      const share = (w.duration || 60) / strengthCount;
      total += 0.1 * weightKg * share;
    }
  }
  return Math.round(total);
}

export default function AnalyticsPage() {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [foodEntries, setFoodEntries] = useState<{date: string; calories: number}[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weight, setWeight] = useState(84);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => { loadData(); }, [weekOffset]);

  async function loadData() {
    const start = dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').format('YYYY-MM-DD');
    const end = dayjs(start).add(6, 'day').format('YYYY-MM-DD');
    const [profile, plansData, foods, workouts] = await Promise.all([
      getOrCreateProfile(),
      getDailyPlansInRange(start, end),
      getFoodEntriesInRange(start, end),
      getWorkoutLogsInRange(start, end),
    ]);
    setWeight(profile.weight);
    setPlans(plansData);
    setWorkoutLogs(workouts);
    // Aggregate food calories by date
    const foodMap: Record<string, number> = {};
    for (const f of foods) {
      foodMap[f.date] = (foodMap[f.date] || 0) + f.calories;
    }
    setFoodEntries(Object.entries(foodMap).map(([date, calories]) => ({ date, calories })));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').add(i, 'day').format('YYYY-MM-DD'));

  // Daily pie: top 5 tasks by name, rest = other
  const latestPlan = [...plans].sort((a, b) => b.date.localeCompare(a.date))[0];
  const allTaskTimes = latestPlan ? latestPlan.tasks
    .filter(t => (t.actualMinutes || 0) > 0)
    .reduce((acc, t) => {
      acc[t.text] = (acc[t.text] || 0) + (t.actualMinutes || 0);
      return acc;
    }, {} as Record<string, number>) : {};
  const sortedTasks = Object.entries(allTaskTimes).sort((a, b) => b[1] - a[1]);
  const top5 = sortedTasks.slice(0, 5);
  const otherTime = sortedTasks.slice(5).reduce((s, [, v]) => s + v, 0);
  const pieData: Record<string, number> = Object.fromEntries(top5);
  if (otherTime > 0) pieData['其它'] = otherTime;
  const pieTotal = Object.values(pieData).reduce((a, b) => a + b, 0);

  // Weekly bar: each task name as a segment
  const allTaskNames = new Set<string>();
  plans.forEach(p => p.tasks.forEach(t => { if ((t.actualMinutes || 0) > 0) allTaskNames.add(t.text); }));
  const taskNames = Array.from(allTaskNames);
  const barData = weekDays.map(date => {
    const plan = plans.find(p => p.date === date);
    const dayTasks: Record<string, number> = {};
    plan?.tasks.forEach(t => {
      if ((t.actualMinutes || 0) > 0) dayTasks[t.text] = (dayTasks[t.text] || 0) + t.actualMinutes;
    });
    return { date, day: dayjs(date).format('ddd'), tasks: dayTasks };
  });
  const maxBar = Math.max(...barData.map(d => Object.values(d.tasks).reduce((s, v) => s + v, 0)), 1);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 py-1 rounded-md border text-sm">← 上周</button>
        <span className="text-sm text-muted-foreground">
          {dayjs(weekDays[0]).format('M月D日')} - {dayjs(weekDays[6]).format('M月D日')}
        </span>
        <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} className="px-3 py-1 rounded-md border text-sm">下周 →</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">任务耗时分布 ({latestPlan ? dayjs(latestPlan.date).format('M月D日') : '暂无数据'})</CardTitle></CardHeader>
          <CardContent>
            {pieTotal > 0 ? (
              <>
                <div className="flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-48 h-48">
                    {Object.entries(pieData).reduce((acc: any[], [name, val], i, arr) => {
                      const prev = arr.slice(0, i).reduce((s: number, [, v]: [string, number]) => s + v, 0);
                      const start = (prev / pieTotal) * 360;
                      const end = ((prev + val) / pieTotal) * 360;
                      const largeArc = end - start > 180 ? 1 : 0;
                      const x1 = 50 + 40 * Math.cos((start - 90) * Math.PI / 180);
                      const y1 = 50 + 40 * Math.sin((start - 90) * Math.PI / 180);
                      const x2 = 50 + 40 * Math.cos((end - 90) * Math.PI / 180);
                      const y2 = 50 + 40 * Math.sin((end - 90) * Math.PI / 180);
                      acc.push(
                        <path key={name} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={TASK_COLORS[i % TASK_COLORS.length]} />
                      );
                      return acc;
                    }, [])}
                    <text x="50" y="52" textAnchor="middle" className="text-[10px] fill-foreground font-bold">{pieTotal}min</text>
                  </svg>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {Object.entries(pieData).map(([name], i) => (
                    <div key={name} className="flex items-center gap-1 text-xs">
                      <span className="w-3 h-3 rounded-full" style={{ background: TASK_COLORS[i % TASK_COLORS.length] }} />
                      <span className="truncate max-w-[80px]">{name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">本周每日耗时</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-48">
              {barData.map((d, i) => {
                const total = Object.values(d.tasks).reduce((s, v) => s + v, 0);
                const h = total > 0 ? (total / maxBar) * 100 : 0;
                const entries = Object.entries(d.tasks);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(4, h)}%` }}>
                      {entries.map(([name, val]) => (
                        <div key={name} style={{ height: `${(val / total) * 100}%`, background: TASK_COLORS[taskNames.indexOf(name) % TASK_COLORS.length] }} title={`${name}: ${val}min`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                    {total > 0 && <span className="text-[10px] text-muted-foreground">{total}m</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
              {taskNames.map((name, i) => (
                <div key={name} className="flex items-center gap-1 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ background: TASK_COLORS[i % TASK_COLORS.length] }} />
                  <span className="truncate max-w-[80px]">{name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">热量摄入 vs 消耗 ({dayjs(weekDays[0]).format('M月D日')} - {dayjs(weekDays[6]).format('M月D日')})</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const intakeData = weekDays.map(d => foodEntries.find(f => f.date === d)?.calories || 0);
              const burnData = weekDays.map(d => {
                const w = workoutLogs.find(l => l.date === d);
                return w ? calcWorkoutBurn(w, weight) : 0;
              });
              const maxVal = Math.max(...intakeData, ...burnData, 500);
              const avgIntake = intakeData.filter(v => v > 0).length > 0 ? Math.round(intakeData.reduce((a, b) => a + b, 0) / intakeData.filter(v => v > 0).length) : 0;
              const avgBurn = burnData.filter(v => v > 0).length > 0 ? Math.round(burnData.reduce((a, b) => a + b, 0) / burnData.filter(v => v > 0).length) : 0;
              return (
                <>
                  <div className="flex items-end gap-1 h-40 mb-2">
                    {weekDays.map((d, i) => {
                      const intakeH = intakeData[i] > 0 ? (intakeData[i] / maxVal) * 100 : 0;
                      const burnH = burnData[i] > 0 ? (burnData[i] / maxVal) * 100 : 0;
                      return (
                        <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '100%' }}>
                            <div style={{ height: `${Math.max(2, intakeH)}%`, width: '40%' }} className="bg-blue-400 rounded-t" title={`摄入: ${intakeData[i]}kcal`} />
                            <div style={{ height: `${Math.max(2, burnH)}%`, width: '40%' }} className="bg-orange-400 rounded-t" title={`消耗: ${burnData[i]}kcal`} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{dayjs(d).format('ddd')}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 text-xs mb-3">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> 摄入</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded" /> 消耗</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">日均摄入</div>
                      <div className="font-semibold text-blue-600">{avgIntake} kcal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">日均消耗</div>
                      <div className="font-semibold text-orange-600">{avgBurn} kcal</div>
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">简单数据分析</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {plans.length > 0 ? (
              <>
                <p>本周记录天数: <span className="font-semibold">{plans.length}</span> 天</p>
                <p>平均每日专注时长: <span className="font-semibold">{Math.round(plans.reduce((s, p) => s + p.totalFocusMinutes, 0) / plans.length)}</span> 分钟</p>
                <p>总完成任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'completed').length, 0)}</span></p>
                <p>总失败任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'failed').length, 0)}</span></p>
                {(() => {
                  const totalIntake = foodEntries.reduce((s, e) => s + e.calories, 0);
                  const totalBurn = workoutLogs.reduce((s, w) => s + calcWorkoutBurn(w, weight), 0);
                  return (
                    <>
                      <p>本周总摄入: <span className="font-semibold text-blue-600">{totalIntake} kcal</span></p>
                      <p>本周总消耗: <span className="font-semibold text-orange-600">{totalBurn} kcal</span></p>
                      <p>热量缺口: <span className={`font-semibold ${totalIntake - totalBurn > 0 ? 'text-green-600' : 'text-red-600'}`}>{totalIntake - totalBurn} kcal</span></p>
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-muted-foreground">本周暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
