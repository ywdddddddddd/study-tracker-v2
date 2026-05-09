import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { type WeeklyReview, getWeeklyReview, saveWeeklyReview, getDailyPlansInRange } from '../../lib/db';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useRegisterSave } from '../../hooks/useTabGuard';
import SaveIndicator from '../ui/SaveIndicator';
import { SkeletonCard } from '../ui/SkeletonCard';
import dayjs from 'dayjs';
import { Target, Clock, Zap, BookOpen, Dumbbell, TrendingUp } from 'lucide-react';

function defaultReview() {
  return { timeHole: '', focusHours: 0, adjust: '', budgetDental: 10.5, budgetEnglish: 7, budgetReview: 2, budgetSport: 3.5, taskGoals: '', progressGoals: '', goals: '' };
}

export default function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [thisWeek, setThisWeek] = useState<WeeklyReview | null>(null);
  const [nextWeek, setNextWeek] = useState<WeeklyReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [weekStatus, setWeekStatus] = useState<Record<string, boolean>>({});
  const [thisWeekUsage, setThisWeekUsage] = useState({ dental: 0, english: 0, other: 0 });
  const [nextWeekUsage, setNextWeekUsage] = useState({ dental: 0, english: 0, other: 0 });

  const combinedData = { thisWeek, nextWeek };
  const { status: saveStatus, save, markDirty } = useAutoSave({
    data: combinedData,
    saveFn: async (d) => {
      if (d.thisWeek) await saveWeeklyReview(d.thisWeek);
      if (d.nextWeek) await saveWeeklyReview(d.nextWeek);
    },
    isLoaded: loaded,
  });

  const directSave = useCallback(async () => {
    if (!loaded) return;
    if (thisWeek) await saveWeeklyReview(thisWeek);
    if (nextWeek) await saveWeeklyReview(nextWeek);
  }, [thisWeek, nextWeek, loaded]);

  useRegisterSave('weekly', directSave);

  useEffect(() => {
    (window as any).__saveWeekly = async () => {
      if (thisWeek) await saveWeeklyReview(thisWeek);
      if (nextWeek) await saveWeeklyReview(nextWeek);
    };
  }, [thisWeek, nextWeek]);

  const isMountedRef = useRef(false);

  const loadBoth = useCallback(async () => {
    if (isMountedRef.current) await save();
    isMountedRef.current = true;
    setLoaded(false);
    const nextStart = dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD');
    const [existing, nextExisting] = await Promise.all([
      getWeeklyReview(weekStart), getWeeklyReview(nextStart),
    ]);
    setThisWeek(existing || { weekStart, ...defaultReview() });
    setNextWeek(nextExisting || { weekStart: nextStart, ...defaultReview() });

    // Load actual usage for progress bars
    const thisWeekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
    const nextWeekEnd = dayjs(nextStart).add(6, 'day').format('YYYY-MM-DD');
    const [thisPlans, nextPlans] = await Promise.all([
      getDailyPlansInRange(weekStart, thisWeekEnd),
      getDailyPlansInRange(nextStart, nextWeekEnd),
    ]);
    const calcUsage = function (plans: any[]) {
      const u = { dental: 0, english: 0, other: 0 };
      for (const p of plans) for (const t of (p.tasks || [])) {
        if (t.status === 'completed' && t.category in u) {
          const cat = t.category as keyof typeof u;
          u[cat] = (u[cat] || 0) + (t.actualMinutes || 0);
        }
      }
      return u;
    };
    setThisWeekUsage(calcUsage(thisPlans));
    setNextWeekUsage(calcUsage(nextPlans));

    setLoaded(true);
  }, [weekStart]);
  useEffect(() => { loadBoth(); }, [loadBoth]);

  const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
  const nextEnd = dayjs(weekStart).add(13, 'day').format('YYYY-MM-DD');
  const scheduleWeeks = Array.from({ length: 5 }, (_, i) => {
    const start = dayjs(weekStart).add(i * 7, 'day');
    return { start: start.format('YYYY-MM-DD'), end: start.add(6, 'day').format('YYYY-MM-DD') };
  });
  const loadWeekStatus = async () => {
    const s: Record<string, boolean> = {};
    for (const w of scheduleWeeks) { const r = await getWeeklyReview(w.start); s[w.start] = !!r; }
    setWeekStatus(s);
  };

  const budgetCards = [
    { key: 'budgetDental', label: '专业课', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
    { key: 'budgetEnglish', label: '英语', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
    { key: 'budgetReview', label: '复盘', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
    { key: 'budgetSport', label: '运动', icon: Dumbbell, color: 'text-orange-600', bg: 'bg-orange-50', bar: 'bg-orange-500' },
  ];

  const renderCard = (review: WeeklyReview | null, setReview: (r: WeeklyReview) => void, label: string, start: string, end: string, usage: { dental: number; english: number; other: number }) => {
    const totalBudget = ((review as any)?.budgetDental || 0) + ((review as any)?.budgetEnglish || 0) + ((review as any)?.budgetReview || 0) + ((review as any)?.budgetSport || 0);
    const usageMap: Record<string, number> = { budgetDental: usage.dental, budgetEnglish: usage.english, budgetReview: usage.other, budgetSport: 0 };
    return (
    <Card className="card-elevated">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span>{label}</span>
          <span className="text-xs text-muted-foreground ml-auto">{dayjs(start).format('M月D日')} - {dayjs(end).format('M月D日')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget progress bars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {budgetCards.map(({ key, label, icon: Icon, color, bg, bar }) => {
              const budgetH = ((review as any)?.[key] || 0);
              const budgetMin = budgetH * 60;
              const usedMin = usageMap[key] || 0;
              const pct = budgetMin > 0 ? (usedMin / budgetMin * 100) : (usedMin > 0 ? 200 : 0);
              return (
            <div key={key} className={`${bg} rounded-xl p-3 text-center`}>
              <div className={`text-lg font-bold ${color}`}>{budgetH.toFixed(1)}h</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" />{label}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted-foreground/20 overflow-hidden">
                <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                已完成 {Math.round(usedMin)}min{pct > 99 ? (pct > 100 ? ' 🔥超额' : ' ✅') : ''}
              </div>
            </div>
              );
            })}
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="w-4 h-4" />
          <span>总配额 <strong className="text-foreground">{totalBudget.toFixed(1)}h</strong></span>
          <span className="mx-2">|</span>
          <span>日均专注 <strong className="text-foreground">{(review?.focusHours || 0).toFixed(1)}h</strong></span>
          <span className="mx-2">|</span>
          <span>时间黑洞</span>
        </div>
        <Textarea value={review?.timeHole || ''} onChange={e => { review && setReview({ ...review, timeHole: e.target.value }); markDirty(); }} placeholder="效率低下的原因（如：刷手机、犯困）" rows={1} />

        {/* Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />学习目标（任务量）</label>
            <Textarea value={review?.taskGoals || ''} onChange={e => { review && setReview({ ...review, taskGoals: e.target.value }); markDirty(); }} placeholder="单词50页、真题2套..." rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />进度目标（范围）</label>
            <Textarea value={review?.progressGoals || ''} onChange={e => { review && setReview({ ...review, progressGoals: e.target.value }); markDirty(); }} placeholder="口组病第3-7章..." rows={2} />
          </div>
        </div>
        <Textarea value={review?.goals || ''} onChange={e => { review && setReview({ ...review, goals: e.target.value }); markDirty(); }} placeholder="综合目标（1-2个最重要）" rows={1} />
        <Textarea value={review?.adjust || ''} onChange={e => { review && setReview({ ...review, adjust: e.target.value }); markDirty(); }} placeholder="本周反思与调整" rows={1} />
      </CardContent>
    </Card>
  );};

  return (
    <div className="space-y-6 animate-in">
      {!loaded ? <SkeletonCard /> : (<>
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={async () => { const n = !showSchedule; setShowSchedule(n); if (n) await loadWeekStatus(); }}>
          📅 {showSchedule ? '隐藏' : '每周日程'}
        </Button>
        <SaveIndicator status={saveStatus} onSave={directSave} className="ml-auto" />
      </div>

      {showSchedule && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">每周日程</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {scheduleWeeks.map(w => {
                const hasData = weekStatus[w.start];
                return (
                  <button key={w.start} onClick={() => { setWeekStart(w.start); setShowSchedule(false); }}
                    className={`p-3 rounded-lg text-center border transition-colors ${w.start === weekStart ? 'border-primary bg-primary/10 font-semibold' : hasData ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 hover:bg-muted'}`}>
                    <div className="font-medium">{dayjs(w.start).format('M/D')}</div>
                    <div className="text-[10px] text-muted-foreground">- {dayjs(w.end).format('M/D')}</div>
                    <div className="text-[10px] mt-1">{hasData ? '●' : '○'}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {renderCard(thisWeek, r => setThisWeek(r), '本周核心目标与时间预算', weekStart, weekEnd, thisWeekUsage)}
      {renderCard(nextWeek, r => setNextWeek(r), '下周核心目标与时间预算', dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'), nextEnd, nextWeekUsage)}
      </>)}
    </div>
  );
}
