import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { type WeeklyReview, getWeeklyReview, saveWeeklyReview } from '../../lib/db';
import dayjs from 'dayjs';

interface ReviewFields {
  timeHole: string;
  focusHours: number;
  adjust: string;
  budgetDental: number;
  budgetEnglish: number;
  budgetReview: number;
  budgetSport: number;
  taskGoals: string;
  progressGoals: string;
  goals: string;
}

function defaultReview(): ReviewFields {
  return {
    timeHole: '',
    focusHours: 0,
    adjust: '',
    budgetDental: 10.5,
    budgetEnglish: 7,
    budgetReview: 2,
    budgetSport: 3.5,
    taskGoals: '',
    progressGoals: '',
    goals: '',
  };
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
      getWeeklyReview(weekStart),
      getWeeklyReview(nextStart),
    ]);
    setThisWeek(existing || { weekStart, ...defaultReview() });
    setNextWeek(nextExisting || { weekStart: nextStart, ...defaultReview() });
  }, [weekStart]);

  useEffect(() => { loadBoth(); }, [loadBoth]);

  const save = async () => {
    if (thisWeek) await saveWeeklyReview(thisWeek);
    if (nextWeek) await saveWeeklyReview(nextWeek);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');
  const nextEnd = dayjs(weekStart).add(13, 'day').format('YYYY-MM-DD');

  // Generate 5 weeks: current week + future 4
  const scheduleWeeks = Array.from({ length: 5 }, (_, i) => {
    const start = dayjs(weekStart).add(i * 7, 'day');
    return { start: start.format('YYYY-MM-DD'), end: start.add(6, 'day').format('YYYY-MM-DD') };
  });

  const loadWeekStatus = async () => {
    const status: Record<string, boolean> = {};
    for (const w of scheduleWeeks) {
      const r = await getWeeklyReview(w.start);
      status[w.start] = !!r;
    }
    setWeekStatus(status);
  };

  const renderCard = (review: WeeklyReview | null, setReview: (r: WeeklyReview) => void, label: string, start: string, end: string) => (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-lg">{label} ({dayjs(start).format('M月D日')} - {dayjs(end).format('M月D日')})</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* 时间黑洞 & 专注 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">时间黑洞</label>
            <Textarea value={review?.timeHole || ''} onChange={e => review && setReview({ ...review, timeHole: e.target.value })} placeholder="刷手机/午睡过长" rows={2} />
          </div>
          <div>
            <label className="text-sm font-medium">日均专注 (h)</label>
            <Input type="number" step="0.5" value={review?.focusHours || ''} onChange={e => review && setReview({ ...review, focusHours: parseFloat(e.target.value) || 0 })} />
            <label className="text-sm font-medium mt-2 block">反思调整</label>
            <Textarea value={review?.adjust || ''} onChange={e => review && setReview({ ...review, adjust: e.target.value })} placeholder="基于执行的反思" rows={2} />
          </div>
        </div>

        {/* 科目配额 */}
        <div>
          <label className="text-sm font-medium mb-2 block">每周科目时间配额 (h)</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '专业课', key: 'budgetDental' },
              { label: '英语', key: 'budgetEnglish' },
              { label: '复盘', key: 'budgetReview' },
              { label: '运动', key: 'budgetSport' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground">{label}</label>
                <Input type="number" step="0.5" value={(review as any)?.[key] || ''} onChange={e => review && setReview({ ...review, [key]: parseFloat(e.target.value) || 0 } as any)} />
              </div>
            ))}
          </div>
        </div>

        {/* 目标 */}
        <div>
          <label className="text-sm font-medium">学习目标（具体任务量）</label>
          <Textarea value={review?.taskGoals || ''} onChange={e => review && setReview({ ...review, taskGoals: e.target.value })} placeholder="英语单词50页、真题卷2套..." rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">进度目标（覆盖范围）</label>
          <Textarea value={review?.progressGoals || ''} onChange={e => review && setReview({ ...review, progressGoals: e.target.value })} placeholder="口组病第3-7章..." rows={2} />
        </div>
        <div>
          <label className="text-sm font-medium">综合目标</label>
          <Textarea value={review?.goals || ''} onChange={e => review && setReview({ ...review, goals: e.target.value })} placeholder="1-2个最重要的" rows={2} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-auto" />
        <span className="text-sm text-muted-foreground">本周基准</span>
        <Button variant="outline" size="sm" onClick={async () => {
          const next = !showSchedule;
          setShowSchedule(next);
          if (next) await loadWeekStatus();
        }}>
          📅 {showSchedule ? '隐藏日程' : '每周日程'}
        </Button>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      {/* Weekly Schedule Grid */}
      {showSchedule && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">每周日程 (当前 + 未来4周)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {scheduleWeeks.map(w => {
                const hasData = weekStatus[w.start];
                const isCurrent = w.start === weekStart;
                return (
                  <button
                    key={w.start}
                    onClick={() => { setWeekStart(w.start); setShowSchedule(false); }}
                    className={`p-3 rounded-md text-center border transition-colors ${
                      isCurrent ? 'border-primary bg-primary/10 font-semibold' :
                      hasData ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100' :
                      'border-gray-200 hover:bg-muted'
                    }`}
                  >
                    <div className="text-[11px] font-medium">{dayjs(w.start).format('M月D日')}</div>
                    <div className="text-[10px] text-muted-foreground">至 {dayjs(w.end).format('M月D日')}</div>
                    <div className="text-[10px] mt-1">
                      {hasData ? <span className="text-emerald-600">● 已填写</span> : <span className="text-gray-300">○ 空白</span>}
                    </div>
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
