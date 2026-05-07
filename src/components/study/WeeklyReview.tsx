import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { type WeeklyReview, getWeeklyReview, saveWeeklyReview } from '../../lib/db';
import dayjs from 'dayjs';
import { Target, Clock, Zap, BookOpen, Dumbbell, TrendingUp } from 'lucide-react';

function defaultReview() {
  return { timeHole: '', focusHours: 0, adjust: '', budgetDental: 10.5, budgetEnglish: 7, budgetReview: 2, budgetSport: 3.5, taskGoals: '', progressGoals: '', goals: '' };
}

export default function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [thisWeek, setThisWeek] = useState<WeeklyReview | null>(null);
  const [nextWeek, setNextWeek] = useState<WeeklyReview | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [weekStatus, setWeekStatus] = useState<Record<string, boolean>>({});

  const loadBoth = useCallback(async () => {
    const nextStart = dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD');
    const [existing, nextExisting] = await Promise.all([
      getWeeklyReview(weekStart), getWeeklyReview(nextStart),
    ]);
    setThisWeek(existing || { weekStart, ...defaultReview() });
    setNextWeek(nextExisting || { weekStart: nextStart, ...defaultReview() });
  }, [weekStart]);
  useEffect(() => { loadBoth(); }, [loadBoth]);

  const save = async () => {
    if (thisWeek) await saveWeeklyReview(thisWeek);
    if (nextWeek) await saveWeeklyReview(nextWeek);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

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

  const renderCard = (review: WeeklyReview | null, setReview: (r: WeeklyReview) => void, label: string, start: string, end: string) => {
    const totalBudget = ((review as any)?.budgetDental || 0) + ((review as any)?.budgetEnglish || 0) + ((review as any)?.budgetReview || 0) + ((review as any)?.budgetSport || 0);
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
          {budgetCards.map(({ key, label, icon: Icon, color, bg, bar }) => (
            <div key={key} className={`${bg} rounded-xl p-3 text-center`}>
              <div className={`text-lg font-bold ${color}`}>{((review as any)?.[key] || 0).toFixed(1)}h</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" />{label}
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted-foreground/20">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, ((review as any)?.[key] || 0) / Math.max(1, totalBudget) * 100 * 4)}%` }} />
              </div>
            </div>
          ))}
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
        <Textarea value={review?.timeHole || ''} onChange={e => review && setReview({ ...review, timeHole: e.target.value })} placeholder="效率低下的原因（如：刷手机、犯困）" rows={1} />

        {/* Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />学习目标（任务量）</label>
            <Textarea value={review?.taskGoals || ''} onChange={e => review && setReview({ ...review, taskGoals: e.target.value })} placeholder="单词50页、真题2套..." rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" />进度目标（范围）</label>
            <Textarea value={review?.progressGoals || ''} onChange={e => review && setReview({ ...review, progressGoals: e.target.value })} placeholder="口组病第3-7章..." rows={2} />
          </div>
        </div>
        <Textarea value={review?.goals || ''} onChange={e => review && setReview({ ...review, goals: e.target.value })} placeholder="综合目标（1-2个最重要）" rows={1} />
        <Textarea value={review?.adjust || ''} onChange={e => review && setReview({ ...review, adjust: e.target.value })} placeholder="本周反思与调整" rows={1} />
      </CardContent>
    </Card>
  );};

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-auto" />
        <Button variant="outline" size="sm" onClick={async () => { const n = !showSchedule; setShowSchedule(n); if (n) await loadWeekStatus(); }}>
          📅 {showSchedule ? '隐藏' : '每周日程'}
        </Button>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
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

      {renderCard(thisWeek, r => setThisWeek(r), '本周核心目标与时间预算', weekStart, weekEnd)}
      {renderCard(nextWeek, r => setNextWeek(r), '下周核心目标与时间预算', dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'), nextEnd)}
    </div>
  );
}
