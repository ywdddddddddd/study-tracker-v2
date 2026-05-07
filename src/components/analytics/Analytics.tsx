import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getOrCreateProfile, getDailyPlansInRange, getFoodEntriesInRange, getWorkoutLogsInRange, getSleepRecords } from '../../lib/db';
import type { DailyPlan, WorkoutLog, SleepRecord } from '../../types';
import dayjs from 'dayjs';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// Safe global config — only set what doesn't break
ChartJS.defaults.responsive = true;
ChartJS.defaults.maintainAspectRatio = false;

const TASK_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];
const TASK_COLORS_SOFT = ['rgba(59,130,246,0.7)', 'rgba(239,68,68,0.7)', 'rgba(34,197,94,0.7)', 'rgba(245,158,11,0.7)', 'rgba(168,85,247,0.7)', 'rgba(236,72,153,0.7)', 'rgba(6,182,212,0.7)', 'rgba(132,204,22,0.7)'];

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let cardioTotal = 0;
  for (const ex of w.exercises) {
    if (ex.kind === 'cardio' && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      cardioTotal += mets * weightKg * (duration / 60);
    }
  }
  const cardioDuration = w.exercises.filter(e => e.kind === 'cardio').reduce((sum, e) => sum + (e.cardioParams?.duration || 0), 0);
  const strengthDuration = Math.max(0, (w.duration || 0) - cardioDuration);
  const strengthTotal = strengthDuration > 0 ? 4.5 * weightKg * (strengthDuration / 60) : 0;
  return Math.round(cardioTotal + strengthTotal);
}

function calculateBMR(weight: number, height: number, age: number, gender: string): number {
  if (gender === 'male') return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

export default function AnalyticsPage() {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [foodEntries, setFoodEntries] = useState<{date: string; calories: number}[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [weight, setWeight] = useState(84);
  const [height, setHeight] = useState(183);
  const [age, setAge] = useState(23);
  const [gender, setGender] = useState('male');
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => { loadData(); }, [weekOffset]);

  async function loadData() {
    const start = dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').format('YYYY-MM-DD');
    const end = dayjs(start).add(6, 'day').format('YYYY-MM-DD');
    const [profile, plansData, foods, workouts, sleepData] = await Promise.all([
      getOrCreateProfile(),
      getDailyPlansInRange(start, end),
      getFoodEntriesInRange(start, end),
      getWorkoutLogsInRange(start, end),
      getSleepRecords(7).then(arr => arr.reverse()),
    ]);
    setWeight(profile.weight);
    setHeight(profile.height);
    setAge(profile.age);
    setGender(profile.gender);
    setPlans(plansData);
    setWorkoutLogs(workouts);
    setSleepRecords(sleepData);
    const foodMap: Record<string, number> = {};
    for (const f of foods) foodMap[f.date] = (foodMap[f.date] || 0) + f.calories;
    setFoodEntries(Object.entries(foodMap).map(([date, calories]) => ({ date, calories })));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').add(i, 'day').format('YYYY-MM-DD'));

  // Pie data
  const latestPlan = [...plans].sort((a, b) => b.date.localeCompare(a.date))[0];
  const allTaskTimes = latestPlan ? latestPlan.tasks.filter(t => (t.actualMinutes || 0) > 0).reduce((acc, t) => {
    acc[t.text] = (acc[t.text] || 0) + (t.actualMinutes || 0); return acc;
  }, {} as Record<string, number>) : {};
  const sortedTasks = Object.entries(allTaskTimes).sort((a, b) => b[1] - a[1]);
  const top5 = sortedTasks.slice(0, 8);
  const pieLabels = top5.map(([name]) => name.length > 12 ? name.slice(0, 12) + '...' : name);
  const pieValues = top5.map(([, v]) => v);

  // Bar data
  const allTaskNames = new Set<string>();
  plans.forEach(p => p.tasks.forEach(t => { if ((t.actualMinutes || 0) > 0) allTaskNames.add(t.text); }));
  const taskNames = Array.from(allTaskNames);
  const barDatasets = taskNames.map((name, i) => ({
    label: name.length > 12 ? name.slice(0, 12) + '...' : name,
    data: weekDays.map(date => {
      const plan = plans.find(p => p.date === date);
      let total = 0;
      plan?.tasks.forEach(t => { if (t.text === name) total += (t.actualMinutes || 0); });
      return total;
    }),
    backgroundColor: TASK_COLORS_SOFT[i % TASK_COLORS.length],
    borderColor: TASK_COLORS[i % TASK_COLORS.length],
    borderWidth: 1,
  }));
  const barData = { labels: weekDays.map(d => dayjs(d).format('ddd')), datasets: barDatasets };

  // Calorie data
  const bmr = calculateBMR(weight, height, age, gender);
  const intakeData = weekDays.map(d => foodEntries.find(f => f.date === d)?.calories || 0);
  const workoutBurnData = weekDays.map(d => { const w = workoutLogs.find(l => l.date === d); return w ? calcWorkoutBurn(w, weight) : 0; });
  const totalBurnData = workoutBurnData.map((b, i) => {
    const hasData = foodEntries.some(f => f.date === weekDays[i]) || workoutLogs.some(w => w.date === weekDays[i]);
    return hasData ? b + bmr : 0;
  });
  const deficitData = intakeData.map((intake, i) => totalBurnData[i] - intake);
  const avgIntake = intakeData.filter(v => v > 0).length > 0 ? Math.round(intakeData.reduce((a, b) => a + b, 0) / intakeData.filter(v => v > 0).length) : 0;
  const avgWorkoutBurn = workoutBurnData.filter(v => v > 0).length > 0 ? Math.round(workoutBurnData.reduce((a, b) => a + b, 0) / workoutBurnData.filter(v => v > 0).length) : 0;
  const recordedDays = plans.length || 1;
  const avgTotalBurn = Math.round(totalBurnData.filter(v => v > 0).reduce((s, v) => s + v, 0) / (totalBurnData.filter(v => v > 0).length || 1));
  const avgDeficit = Math.round(deficitData.reduce((a, b) => a + b, 0) / recordedDays);

  const calBarData = {
    labels: weekDays.map(d => dayjs(d).format('ddd')),
    datasets: [
      { label: '摄入', data: intakeData, backgroundColor: 'rgba(96,165,250,0.7)', borderColor: '#3b82f6', borderWidth: 1 },
      { label: '总消耗', data: totalBurnData, backgroundColor: 'rgba(251,146,60,0.7)', borderColor: '#f97316', borderWidth: 1 },
    ],
  };

  const calLineData = {
    labels: weekDays.map(d => dayjs(d).format('ddd')),
    datasets: [
      { label: '摄入', data: intakeData, borderColor: '#3b82f6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 4 },
      { label: '总消耗', data: totalBurnData, borderColor: '#f97316', backgroundColor: 'transparent', tension: 0.3, pointRadius: 4, borderDash: [5, 3] },
      { label: '赤字', data: deficitData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
    ],
  };

  // Sleep chart data
  const sleepBed = sleepRecords.map(s => {
    const h = parseInt(s.bedTime.split(':')[0]) + parseInt(s.bedTime.split(':')[1]) / 60;
    return (h + 2) % 24; // normalize: 22:00→20, 02:00→4
  });
  const sleepWake = sleepRecords.map(s => {
    const h = parseInt(s.wakeTime.split(':')[0]) + parseInt(s.wakeTime.split(':')[1]) / 60;
    return h + 2; // normalize: 07:00→9
  });
  const sleepChartData = {
    labels: sleepRecords.map(s => s.date.slice(5)),
    datasets: [
      { label: '入睡', data: sleepBed, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.3)', tension: 0.3, pointRadius: 5 },
      { label: '起床', data: sleepWake, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.3)', tension: 0.3, pointRadius: 5 },
    ],
  };

  const chartOpts = () => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' as const },
    plugins: {
      tooltip: { enabled: true, mode: 'index' as const, intersect: false },
      legend: { position: 'bottom' as const, labels: { font: { size: 10 }, boxWidth: 12, padding: 8, usePointStyle: true } },
    },
    scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } }, beginAtZero: true } },
  });

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <button onClick={() => setWeekOffset(w => w + 1)} className="px-3 py-1 rounded-md border text-sm">← 上周</button>
        <span className="text-sm text-muted-foreground">{dayjs(weekDays[0]).format('M月D日')} - {dayjs(weekDays[6]).format('M月D日')}</span>
        <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} className="px-3 py-1 rounded-md border text-sm">下周 →</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">任务耗时分布 ({latestPlan ? dayjs(latestPlan.date).format('M月D日') : '暂无数据'})</CardTitle></CardHeader>
          <CardContent>
            {pieValues.reduce((a, b) => a + b, 0) > 0 ? (
              <div className="h-48">
                <Doughnut data={{ labels: pieLabels, datasets: [{ data: pieValues, backgroundColor: TASK_COLORS, borderWidth: 0 }] }} options={{ ...chartOpts(), cutout: '55%', plugins: { ...chartOpts().plugins, legend: { position: 'right' as const, labels: { font: { size: 9 }, boxWidth: 10, padding: 4 } } } }} />
              </div>
            ) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">本周每日耗时</CardTitle></CardHeader>
          <CardContent>
            {taskNames.length > 0 ? (
              <div className="h-48">
                <Bar data={barData} options={{ ...chartOpts(), scales: { x: { stacked: true, ticks: { font: { size: 9 } } }, y: { stacked: true, ticks: { font: { size: 9 } }, beginAtZero: true } } }} />
              </div>
            ) : <p className="text-muted-foreground text-center py-8">暂无数据</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">热量摄入 vs 消耗 ({dayjs(weekDays[0]).format('M月D日')} - {dayjs(weekDays[6]).format('M月D日')})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <Bar data={calBarData} options={{ ...chartOpts(), scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } }, beginAtZero: true } } }} />
            </div>
            <div className="h-48 mt-4">
              <Line data={calLineData} options={{ ...chartOpts(), scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } }, beginAtZero: true } } }} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2 mt-2">
              <div className="text-center"><div className="text-muted-foreground text-xs">日均摄入</div><div className="font-semibold text-blue-600">{avgIntake} kcal</div></div>
              <div className="text-center"><div className="text-muted-foreground text-xs">日均总消耗</div><div className="font-semibold text-orange-600">{avgTotalBurn} kcal</div><div className="text-[10px] text-muted-foreground">运动 {avgWorkoutBurn} + BMR {bmr}</div></div>
            </div>
            <div className="mt-2 text-center border-t pt-2"><div className="text-muted-foreground text-xs">日均热量赤字</div>
              <div className={`font-semibold ${avgDeficit > 0 ? 'text-green-600' : 'text-red-600'}`}>{avgDeficit > 0 ? '+' : ''}{avgDeficit} kcal</div>
              <div className="text-[10px] text-muted-foreground">{avgDeficit > 500 ? '减脂速度较快' : avgDeficit > 0 ? '减脂速度适中' : avgDeficit < -200 ? '可能增重' : '基本平衡'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">简单数据分析</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {plans.length > 0 ? (<>
              <p>本周记录天数: <span className="font-semibold">{plans.length}</span> 天</p>
              <p>平均每日专注时长: <span className="font-semibold">{Math.round(plans.reduce((s, p) => s + p.totalFocusMinutes, 0) / plans.length)}</span> 分钟</p>
              <p>总完成任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'completed').length, 0)}</span></p>
              <p>总失败任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'failed').length, 0)}</span></p>
              {(() => {
                const totalIntake = foodEntries.reduce((s, e) => s + e.calories, 0);
                const totalWorkoutBurn = workoutLogs.reduce((s, w) => s + calcWorkoutBurn(w, weight), 0);
                const recordedDays = plans.length || 1;
                const totalBMR = bmr * recordedDays;
                const totalBurn = totalWorkoutBurn + totalBMR;
                const deficit = totalBurn - totalIntake;
                return (<>
                  <p>本周总摄入: <span className="font-semibold text-blue-600">{totalIntake} kcal</span></p>
                  <p>本周总消耗: <span className="font-semibold text-orange-600">{totalBurn} kcal</span></p>
                  <p className="text-[10px] text-muted-foreground">运动 {totalWorkoutBurn} + 基础代谢 {totalBMR} (BMR {bmr}/天)</p>
                  <p>热量赤字: <span className={`font-semibold ${deficit > 0 ? 'text-green-600' : 'text-red-600'}`}>{deficit > 0 ? '+' : ''}{deficit} kcal</span></p>
                  <p className="text-[10px] text-muted-foreground">{deficit > 0 ? `约可减脂 ${(deficit / 7700).toFixed(2)} kg` : '热量盈余，建议控制饮食'}</p>
                </>);
              })()}
            </>) : <p className="text-muted-foreground">本周暂无数据</p>}
          </CardContent>
        </Card>
      </div>

      {sleepRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">本周睡眠作息 ({sleepRecords[0]?.date.slice(5)} - {sleepRecords[sleepRecords.length-1]?.date.slice(5)})</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <Line data={sleepChartData} options={{
                ...chartOpts(),
                scales: {
                  x: { ticks: { font: { size: 9 } } },
                  y: { min: 0, max: 14, ticks: { font: { size: 8 }, stepSize: 2, callback: (v: any) => { const h = (v - 2 + 24) % 24; return `${h}:00`; } } },
                },
                plugins: { ...chartOpts().plugins, legend: { position: 'bottom' as const, labels: { font: { size: 10 } } } },
              }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
