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
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      {renderCard(thisWeek, r => setThisWeek(r), '本周核心目标与时间预算', weekStart, weekEnd)}
      {renderCard(nextWeek, r => setNextWeek(r), '下周核心目标与时间预算', dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'), nextEnd)}
    </div>
  );
}
