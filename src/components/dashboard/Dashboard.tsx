import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { StatCard } from '../ui/shared';
import { Progress } from '../ui/progress';
import { db, type DailyPlan, type Profile, type WeightRecord, getOrCreateProfile } from '../../lib/db';
import { STUDY_SCHEDULE } from '../../data/presets';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [stats, setStats] = useState({ completed: 0, total: 0, rate: 0, streak: 0 });
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const p = await getOrCreateProfile();
    setProfile(p);
    const plan = await db.dailyPlans.where('date').equals(today).first();
    setTodayPlan(plan || null);

    const allPlans = await db.dailyPlans.toArray();
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

    const wr = await db.weightRecords.orderBy('date').toArray();
    setWeightRecords(wr);
  }

  const scheduleToday = STUDY_SCHEDULE.find(s => s.date === today);
  const todayDone = todayPlan?.tasks.filter(t => t.status === 'completed').length || 0;
  const todayTotal = todayPlan?.tasks.length || 4;

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
          {scheduleToday ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">健身:</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scheduleToday.gym === '休' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                  {scheduleToday.gym === '推' ? '推 (胸+肩+三头)' : scheduleToday.gym === '拉' ? '拉 (背+肩后束+二头)' : scheduleToday.gym === '腿' ? '腿 (股四+腘绳+臀)' : '休息日'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">今日任务:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {scheduleToday.tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span>{todayPlan?.tasks[i]?.status === 'completed' ? '✅' : '⬜'}</span>
                      <span className={todayPlan?.tasks[i]?.status === 'completed' ? 'line-through opacity-60' : ''}>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>今日进度</span>
                  <span>{todayDone}/{todayTotal}</span>
                </div>
                <Progress value={todayDone} max={todayTotal} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">今天暂无预设日程，请前往「每日计划」手动添加。</p>
          )}
        </CardContent>
      </Card>

      {weightRecords.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">体重趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {weightRecords.slice(-14).map((w, i) => {
                const min = Math.min(...weightRecords.slice(-14).map(w => w.weight));
                const max = Math.max(...weightRecords.slice(-14).map(w => w.weight));
                const range = max - min || 1;
                const h = ((w.weight - min) / range) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary rounded-t" style={{ height: `${Math.max(10, h)}%` }} />
                    <span className="text-[10px] text-muted-foreground">{dayjs(w.date).format('D')}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>最新: {weightRecords[weightRecords.length - 1]?.weight} kg</span>
              <span>变化: {(weightRecords[weightRecords.length - 1]?.weight - weightRecords[0]?.weight).toFixed(1)} kg</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
