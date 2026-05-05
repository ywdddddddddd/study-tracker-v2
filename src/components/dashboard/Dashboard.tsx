import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { StatCard } from '../ui/shared';
import { Progress } from '../ui/progress';
import { db, type DailyPlan, type Profile, getOrCreateProfile } from '../../lib/db';
import { STUDY_SCHEDULE } from '../../data/presets';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayPlan, setTodayPlan] = useState<DailyPlan | null>(null);
  const [stats, setStats] = useState({ completed: 0, total: 0, rate: 0, streak: 0 });
  const today = dayjs().format('YYYY-MM-DD');

  useEffect(() => { loadData(); }, []);

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
  }

  const scheduleToday = STUDY_SCHEDULE.find(s => s.date === today);
  const todayDone = todayPlan?.tasks.filter(t => t.status === 'completed').length || 0;
  const todayTotal = todayPlan?.tasks.length || 0;

  const categoryLabel = (cat: string) => cat === 'english' ? '英语' : cat === 'dental' ? '专业课' : '其它';
  const categoryColor = (cat: string) => cat === 'english' ? 'text-blue-600 bg-blue-50' : cat === 'dental' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';

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
                <ul className="text-sm space-y-1">
                  {scheduleToday.tasks.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span>{todayPlan?.tasks[i]?.status === 'completed' ? '✅' : '⬜'}</span>
                      <span className={todayPlan?.tasks[i]?.status === 'completed' ? 'line-through opacity-60' : ''}>{t.text}</span>
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
            </>
          ) : (
            <p className="text-muted-foreground">今天暂无预设日程，请前往「每日计划」手动添加。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
