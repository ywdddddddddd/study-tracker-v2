import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { StatCard } from '../ui/shared';
import { Progress } from '../ui/progress';
import { type DailyPlan, type Profile, getOrCreateProfile, calculateMacros, getDailyPlan, getAllDailyPlans, getFoodEntries, getWorkoutLog } from '../../lib/db';
import { STUDY_SCHEDULE } from '../../data/presets';
import type { WorkoutLog } from '../../types';
import dayjs from 'dayjs';

function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
  let total = 0;
  for (const ex of w.exercises) {
    if (ex.kind === 'cardio' && ex.cardioParams) {
      const speed = ex.cardioParams.speed || 0;
      const incline = ex.cardioParams.incline || 0;
      const duration = ex.cardioParams.duration || 0;
      // Treadmill MET formula from ACSM literature
      const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
      total += mets * weightKg * (duration / 60);
    } else if (ex.kind === 'strength') {
      // Literature-based: ~0.04 kcal per kg bodyweight per minute
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

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [stats, setStats] = useState({ completed: 0, total: 0, rate: 0, streak: 0 });
  const [foodTotal, setFoodTotal] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [workoutBurn, setWorkoutBurn] = useState(0);
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const p = await getOrCreateProfile();
    setProfile(p);
    const plan = await getDailyPlan(today);
    setTodayPlan(plan || null);

    const [allPlans, foods, workout] = await Promise.all([
      getAllDailyPlans(),
      getFoodEntries(today),
      getWorkoutLog(today),
    ]);

    let completed = 0, total = 0;
    allPlans.forEach((dp: DailyPlan) => {
      dp.tasks.forEach((t: {status: string}) => {
        total++;
        if (t.status === 'completed') completed++;
      });
    });
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let streak = 0;
    const dates = allPlans.map(dp => dp.date).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
      const dp = allPlans.find(p => p.date === dates[i]);
      const done = dp?.tasks.filter((t: {status: string}) => t.status === 'completed').length || 0;
      if (done >= 3) streak++;
      else if (dates[i] < today) break;
    }
    setStats({ completed, total, rate, streak });

    const ft = foods.reduce((acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    setFoodTotal(ft);

    if (workout) {
      setWorkoutBurn(calcWorkoutBurn(workout, p.weight));
    } else {
      setWorkoutBurn(0);
    }
  }

  const scheduleToday = STUDY_SCHEDULE.find(s => s.date === today);
  const todayDone = todayPlan?.tasks.filter(t => t.status === 'completed').length || 0;
  const todayTotal = todayPlan?.tasks.length || 0;
  const macros = profile ? calculateMacros(profile) : { calories: 1900, protein: 154, carbs: 156, fat: 63 };
  const bmr = profile ? calculateBMR(profile.weight, profile.height, profile.age, profile.gender) : 1900;
  const totalBurn = workoutBurn + bmr;

  const categoryLabel = (cat: string) => cat === 'english' ? '英语' : cat === 'dental' ? '专业课' : '其它';
  const categoryColor = (cat: string) => cat === 'english' ? 'text-blue-600 bg-blue-50' : cat === 'dental' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';

  // Get gym type from schedule or plan
  const gymType = scheduleToday?.gym || '休';

  return (
    <div className="space-y-6 animate-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="已完成任务" value={stats.completed} subtitle={`共 ${stats.total} 项`} />
        <StatCard title="完成率" value={`${stats.rate}%`} />
        <StatCard title="连续打卡" value={`${stats.streak} 天`} />
        <StatCard title="当前体重" value={`${profile?.weight || '-'} kg`} subtitle={`目标 ${profile?.targetWeight || '-'} kg`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">今日概览 ({dayjs().format('M月D日')})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {todayPlan && todayPlan.tasks.length > 0 ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">健身:</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${gymType === '休' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                  {gymType === '推' ? '推 (胸+肩+三头)' : gymType === '拉' ? '拉 (背+肩后束+二头)' : gymType === '腿' ? '腿 (股四+腘绳+臀)' : '休息日'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">今日任务:</p>
                <ul className="text-sm space-y-1">
                  {todayPlan.tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span>{t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'doing' ? '🔥' : '⬜'}</span>
                      <span className={t.status === 'completed' ? 'line-through opacity-60' : ''}>{t.text}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColor(t.category)}`}>{categoryLabel(t.category)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>今日进度</span>
                  <span>{todayDone}/{todayTotal}</span>
                </div>
                <Progress value={todayDone} max={todayTotal || 1} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">今日饮食</p>
                  <p className="text-sm font-semibold text-blue-600">{foodTotal.calories} / {macros.calories} kcal</p>
                  <p className="text-[10px] text-muted-foreground">P:{foodTotal.protein.toFixed(1)}g C:{foodTotal.carbs.toFixed(1)}g F:{foodTotal.fat.toFixed(1)}g</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">今日消耗</p>
                  <p className="text-sm font-semibold text-orange-600">{totalBurn} kcal</p>
                  <p className="text-[10px] text-muted-foreground">运动 {workoutBurn} + BMR {bmr}</p>
                  <p className="text-[10px] text-muted-foreground">缺口: {totalBurn - foodTotal.calories} kcal</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">今天暂无任务记录，请前往「每日计划」添加。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
