import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { type WeeklyReview, getWeeklyReview, saveWeeklyReview } from '../../lib/db';
import dayjs from 'dayjs';

export default function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD'));
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [saved, setSaved] = useState(false);

  const loadReview = useCallback(async () => {
    const existing = await getWeeklyReview(weekStart);
    if (existing) {
      setReview(existing);
    } else {
      setReview({
        weekStart,
        timeHole: '',
        focusHours: 0,
        budgetDental: 10.5,
        budgetEnglish: 7,
        budgetReview: 2,
        budgetSport: 3.5,
        goals: '',
        adjust: '',
      });
    }
  }, [weekStart]);

  useEffect(() => { loadReview(); }, [loadReview]);

  const save = async () => {
    if (!review) return;
    await saveWeeklyReview(review);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const weekEnd = dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD');

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-2">
        <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="w-auto" />
        <span className="text-sm text-muted-foreground">至 {dayjs(weekEnd).format('M月D日')}</span>
        <Button onClick={save} className="ml-auto">{saved ? '✅ 已保存' : '💾 保存'}</Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">1. 本周时间花在哪了？</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">主要的时间黑洞是？</label>
            <Textarea value={review?.timeHole || ''} onChange={e => review && setReview({ ...review, timeHole: e.target.value })} placeholder="例如：刷手机、午睡过长" />
          </div>
          <div>
            <label className="text-sm font-medium">平均每天能专注学习几个小时？</label>
            <Input type="number" step="0.5" value={review?.focusHours || ''} onChange={e => review && setReview({ ...review, focusHours: parseFloat(e.target.value) || 0 })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">2. 下周预算怎么分？</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            { label: '口腔科目', key: 'budgetDental' },
            { label: '英语', key: 'budgetEnglish' },
            { label: '复盘', key: 'budgetReview' },
            { label: '运动', key: 'budgetSport' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-sm font-medium">{label} (小时)</label>
              <Input type="number" step="0.5" value={(review as any)?.[key] || ''} onChange={e => review && setReview({ ...review, [key]: parseFloat(e.target.value) || 0 } as any)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">3. 下周的核心目标是什么？</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={review?.goals || ''} onChange={e => review && setReview({ ...review, goals: e.target.value })} placeholder="只写1-2个最重要的" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">4. 有什么需要调整的？</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={review?.adjust || ''} onChange={e => review && setReview({ ...review, adjust: e.target.value })} placeholder="基于本周执行的反思" />
        </CardContent>
      </Card>
    </div>
  );
}
