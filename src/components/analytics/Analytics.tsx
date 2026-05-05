import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { db } from '../../lib/db';
import type { DailyPlan } from '../../types';
import dayjs from 'dayjs';

export default function AnalyticsPage() {
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    loadData();
  }, [weekOffset]);

  async function loadData() {
    const start = dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').format('YYYY-MM-DD');
    const end = dayjs(start).add(6, 'day').format('YYYY-MM-DD');
    const data = await db.dailyPlans.filter(p => p.date >= start && p.date <= end).toArray();
    setPlans(data);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => dayjs().startOf('week').add(1, 'day').subtract(weekOffset, 'week').add(i, 'day').format('YYYY-MM-DD'));

  const categoryColors: Record<string, string> = {
    study: '#3b82f6',
    fitness: '#ef4444',
    nutrition: '#22c55e',
    other: '#a855f7',
  };

  // Daily pie chart data (most recent day with data)
  const latestPlan = [...plans].sort((a, b) => b.date.localeCompare(a.date))[0];
  const pieData = latestPlan ? latestPlan.tasks.reduce((acc, t) => {
    const cat = t.category || 'other';
    acc[cat] = (acc[cat] || 0) + (t.actualMinutes || 0);
    return acc;
  }, {} as Record<string, number>) : {};
  const pieTotal = Object.values(pieData).reduce((a, b) => a + b, 0);

  // Weekly bar chart data
  const barData = weekDays.map(date => {
    const plan = plans.find(p => p.date === date);
    return {
      date,
      day: dayjs(date).format('ddd'),
      study: plan?.tasks.filter(t => t.category === 'study').reduce((s, t) => s + (t.actualMinutes || 0), 0) || 0,
      fitness: plan?.tasks.filter(t => t.category === 'fitness').reduce((s, t) => s + (t.actualMinutes || 0), 0) || 0,
      nutrition: plan?.tasks.filter(t => t.category === 'nutrition').reduce((s, t) => s + (t.actualMinutes || 0), 0) || 0,
      other: plan?.tasks.filter(t => t.category === 'other').reduce((s, t) => s + (t.actualMinutes || 0), 0) || 0,
    };
  });
  const maxBar = Math.max(...barData.map(d => d.study + d.fitness + d.nutrition + d.other), 1);

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
              <div className="flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-48 h-48">
                  {Object.entries(pieData).reduce((acc: React.ReactElement[], [cat, val], i, arr) => {
                    const prev = arr.slice(0, i).reduce((s: number, [, v]: [string, number]) => s + v, 0);
                    const start = (prev / (pieTotal as number)) * 360;
                    const end = ((prev + (val as number)) / (pieTotal as number)) * 360;
                    const largeArc = end - start > 180 ? 1 : 0;
                    const x1 = 50 + 40 * Math.cos((start - 90) * Math.PI / 180);
                    const y1 = 50 + 40 * Math.sin((start - 90) * Math.PI / 180);
                    const x2 = 50 + 40 * Math.cos((end - 90) * Math.PI / 180);
                    const y2 = 50 + 40 * Math.sin((end - 90) * Math.PI / 180);
                    acc.push(
                      <path key={cat} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={categoryColors[cat]} />
                    );
                    return acc;
                  }, [])}
                  <text x="50" y="52" textAnchor="middle" className="text-[10px] fill-foreground font-bold">{pieTotal}min</text>
                </svg>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">暂无数据</p>
            )}
            <div className="flex justify-center gap-3 mt-2 flex-wrap">
              {Object.entries(categoryColors).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ background: color }} />
                  <span>{cat === 'study' ? '学习' : cat === 'fitness' ? '健身' : cat === 'nutrition' ? '饮食' : '其他'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">本周每日耗时</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {barData.map((d, i) => {
                const total = d.study + d.fitness + d.nutrition + d.other;
                const h = total > 0 ? (total / maxBar) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(4, h)}%` }}>
                      {d.other > 0 && <div style={{ height: `${(d.other/total)*100}%`, background: categoryColors.other }} />}
                      {d.nutrition > 0 && <div style={{ height: `${(d.nutrition/total)*100}%`, background: categoryColors.nutrition }} />}
                      {d.fitness > 0 && <div style={{ height: `${(d.fitness/total)*100}%`, background: categoryColors.fitness }} />}
                      {d.study > 0 && <div style={{ height: `${(d.study/total)*100}%`, background: categoryColors.study }} />}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                    {total > 0 && <span className="text-[10px] text-muted-foreground">{total}m</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">简单数据分析</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {plans.length > 0 ? (
            <>
              <p>本周记录天数: <span className="font-semibold">{plans.length}</span> 天</p>
              <p>平均每日专注时长: <span className="font-semibold">{Math.round(plans.reduce((s, p) => s + p.totalFocusMinutes, 0) / plans.length)}</span> 分钟</p>
              <p>总完成任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'completed').length, 0)}</span></p>
              <p>总失败任务数: <span className="font-semibold">{plans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'failed').length, 0)}</span></p>
            </>
          ) : (
            <p className="text-muted-foreground">本周暂无数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
