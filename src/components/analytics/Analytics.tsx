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
      // Treadmill MET formula from ACSM literature
      // METs = speed(km/h) * 0.2 + incline(%) * 0.9 + 3.5, then divide by 3.5
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      total += mets * weightKg * (duration / 60);
    } else if (ex.kind === 'strength') {
      // Literature-based: ~0.03-0.05 kcal per kg bodyweight per minute of strength training
      // Using 0.04 as conservative estimate for compound lifts with rest periods
      const strengthCount = w.exercises.filter(e => e.kind === 'strength').length || 1;
      const share = (w.duration || 60) / strengthCount;
      total += 0.04 * weightKg * share;
    }
  }
  return Math.round(total);
}

function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  }
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

export default function AnalyticsPage() {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [foodEntries, setFoodEntries] = useState<{date: string; calories: number}[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weight, setWeight] = useState(84);
  const [height, setHeight] = useState(183);
  const [age, setAge] = useState(23);
  const [gender, setGender] = useState('male');
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

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
    setHeight(profile.height);
    setAge(profile.age);
    setGender(profile.gender);
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
                      const sweep = end - start;
                      if (arr.length === 1 || sweep >= 359.99) {
                        acc.push(
                          <circle key={name} cx="50" cy="50" r="40" fill={TASK_COLORS[i % TASK_COLORS.length]} />
                        );
                      } else {
                        const largeArc = sweep > 180 ? 1 : 0;
                        const x1 = 50 + 40 * Math.cos((start - 90) * Math.PI / 180);
                        const y1 = 50 + 40 * Math.sin((start - 90) * Math.PI / 180);
                        const x2 = 50 + 40 * Math.cos((end - 90) * Math.PI / 180);
                        const y2 = 50 + 40 * Math.sin((end - 90) * Math.PI / 180);
                        acc.push(
                          <path key={name} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={TASK_COLORS[i % TASK_COLORS.length]} />
                        );
                      }
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
            <div className="flex gap-1 h-48">
              {barData.map((d, i) => {
                const total = Object.values(d.tasks).reduce((s, v) => s + v, 0);
                const h = total > 0 ? (total / maxBar) * 100 : 0;
                const entries = Object.entries(d.tasks);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1">
                    <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(4, h)}%` }}>
                      {entries.map(([name, val]) => (
                        <div key={name} style={{ height: total > 0 ? `${(val / total) * 100}%` : '0%', background: TASK_COLORS[taskNames.indexOf(name) % TASK_COLORS.length] }} title={`${name}: ${val}min`} />
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
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>热量摄入 vs 消耗 ({dayjs(weekDays[0]).format('M月D日')} - {dayjs(weekDays[6]).format('M月D日')})</span>
              <div className="flex gap-1">
                <button onClick={() => setChartType('bar')} className={`px-2 py-1 rounded text-xs ${chartType === 'bar' ? 'bg-primary text-primary-foreground' : 'border'}`}>条形图</button>
                <button onClick={() => setChartType('line')} className={`px-2 py-1 rounded text-xs ${chartType === 'line' ? 'bg-primary text-primary-foreground' : 'border'}`}>折线图</button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const bmr = calculateBMR(weight, height, age, gender);
              const intakeData = weekDays.map(d => foodEntries.find(f => f.date === d)?.calories || 0);
              const workoutBurnData = weekDays.map(d => {
                const w = workoutLogs.find(l => l.date === d);
                return w ? calcWorkoutBurn(w, weight) : 0;
              });
              const totalBurnData = workoutBurnData.map(b => b + Math.round(bmr));
              const deficitData = intakeData.map((intake, i) => totalBurnData[i] - intake);
              const maxVal = Math.max(...intakeData, ...totalBurnData, 500);
              const avgIntake = intakeData.filter(v => v > 0).length > 0 ? Math.round(intakeData.reduce((a, b) => a + b, 0) / intakeData.filter(v => v > 0).length) : 0;
              const avgWorkoutBurn = workoutBurnData.filter(v => v > 0).length > 0 ? Math.round(workoutBurnData.reduce((a, b) => a + b, 0) / workoutBurnData.filter(v => v > 0).length) : 0;
              const recordedDays = plans.length || 1;
              const avgTotalBurn = Math.round(totalBurnData.reduce((a, b) => a + b, 0) / recordedDays);
              const avgDeficit = Math.round(deficitData.reduce((a, b) => a + b, 0) / recordedDays);
              return (
                <>
                  {chartType === 'bar' ? (
                    <div className="flex gap-1 h-40 mb-2">
                      {weekDays.map((d, i) => {
                        const intakeH = intakeData[i] > 0 ? (intakeData[i] / maxVal) * 100 : 0;
                        const burnH = totalBurnData[i] > 0 ? (totalBurnData[i] / maxVal) * 100 : 0;
                        return (
                          <div key={d} className="flex-1 flex flex-col justify-end items-center gap-0.5">
                            <div className="w-full flex gap-0.5 justify-center" style={{ height: `${Math.max(2, Math.max(intakeH, burnH))}%` }}>
                              <div style={{ width: '40%' }} className="bg-blue-400 rounded-t h-full" title={`摄入: ${intakeData[i]}kcal`} />
                              <div style={{ width: '40%' }} className="bg-orange-400 rounded-t h-full" title={`总消耗: ${totalBurnData[i]}kcal (运动${workoutBurnData[i]} + 基础${bmr})`} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{dayjs(d).format('ddd')}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-40 mb-2 relative">
                      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map(y => (
                          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                        ))}
                        {/* Intake line */}
                        <polyline
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth="1.5"
                          points={weekDays.map((_d, i) => {
                            const x = (i / (weekDays.length - 1)) * 100;
                            const y = 100 - (intakeData[i] > 0 ? (intakeData[i] / maxVal) * 100 : 0);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        {/* Burn line */}
                        <polyline
                          fill="none"
                          stroke="#fb923c"
                          strokeWidth="1.5"
                          points={weekDays.map((_d, i) => {
                            const x = (i / (weekDays.length - 1)) * 100;
                            const y = 100 - (totalBurnData[i] > 0 ? (totalBurnData[i] / maxVal) * 100 : 0);
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        {/* Deficit area */}
                        <polygon
                          fill="rgba(34, 197, 94, 0.2)"
                          stroke="none"
                          points={weekDays.map((_d, i) => {
                            const x = (i / (weekDays.length - 1)) * 100;
                            const intakeY = 100 - (intakeData[i] > 0 ? (intakeData[i] / maxVal) * 100 : 0);
                            return `${x},${intakeY}`;
                          }).join(' ') + ' ' + weekDays.map((_d, i) => {
                            const x = (i / (weekDays.length - 1)) * 100;
                            const burnY2 = 100 - (totalBurnData[i] > 0 ? (totalBurnData[i] / maxVal) * 100 : 0);
                            return `${x},${burnY2}`;
                          }).reverse().join(' ')}
                        />
                      </svg>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        {weekDays.map(d => <span key={d}>{dayjs(d).format('ddd')}</span>)}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-center gap-4 text-xs mb-3">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" /> 摄入</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded" /> 总消耗(含BMR)</span>
                    {chartType === 'line' && <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> 赤字区域</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">日均摄入</div>
                      <div className="font-semibold text-blue-600">{avgIntake} kcal</div>
                    </div>
                    <div className="text-center">
                      <div className="text-muted-foreground text-xs">日均总消耗</div>
                      <div className="font-semibold text-orange-600">{avgTotalBurn} kcal</div>
                      <div className="text-[10px] text-muted-foreground">运动 {avgWorkoutBurn} + BMR {bmr}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-center border-t pt-2">
                    <div className="text-muted-foreground text-xs">日均热量赤字</div>
                    <div className={`font-semibold ${avgDeficit > 0 ? 'text-green-600' : 'text-red-600'}`}>{avgDeficit > 0 ? '+' : ''}{avgDeficit} kcal</div>
                    <div className="text-[10px] text-muted-foreground">{avgDeficit > 500 ? '减脂速度较快' : avgDeficit > 0 ? '减脂速度适中' : avgDeficit < -200 ? '可能增重' : '基本平衡'}</div>
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
                  const totalWorkoutBurn = workoutLogs.reduce((s, w) => s + calcWorkoutBurn(w, weight), 0);
                  const bmr = calculateBMR(weight, height, age, gender);
                  const recordedDays = plans.length || 1;
                  const totalBMR = bmr * recordedDays;
                  const totalBurn = totalWorkoutBurn + totalBMR;
                  const deficit = totalBurn - totalIntake;
                  return (
                    <>
                      <p>本周总摄入: <span className="font-semibold text-blue-600">{totalIntake} kcal</span></p>
                      <p>本周总消耗: <span className="font-semibold text-orange-600">{totalBurn} kcal</span></p>
                      <p className="text-[10px] text-muted-foreground">运动 {totalWorkoutBurn} + 基础代谢 {totalBMR} (BMR {bmr}/天)</p>
                      <p>热量赤字: <span className={`font-semibold ${deficit > 0 ? 'text-green-600' : 'text-red-600'}`}>{deficit > 0 ? '+' : ''}{deficit} kcal</span></p>
                      <p className="text-[10px] text-muted-foreground">{deficit > 0 ? `约可减脂 ${(deficit / 7700).toFixed(2)} kg` : '热量盈余，建议控制饮食'}</p>
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
