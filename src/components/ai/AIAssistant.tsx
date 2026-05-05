import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useAI } from '../../hooks/useAI';
import { db, getOrCreateProfile, calculateMacros } from '../../lib/db';
import dayjs from 'dayjs';

const SYSTEM_PROMPT = `你是一位高效的个人效能管理AI教练，精通学习科学、运动营养学和认知心理学。

你的核心能力：
1. 分析用户每日/每周的执行数据（学习、健身、饮食、体重）
2. 诊断低效根源（五类失分：不会/提不出/分不清/写不稳/考场崩）
3. 给出具体的明日优化建议
4. 当用户采纳建议时，生成可直接执行的明日日程

分析原则：
- 学习：关注"提取率"而非"投入时长"，未完成=计划太满或方法不对
- 健身：关注"渐进超负荷"，重量/容量是否提升
- 饮食：关注"热量赤字+蛋白质达标"，而非完美饮食
- 体重：关注周趋势而非日波动

输出格式：
1. 【数据概览】用1-2句话总结今日/本周关键数字
2. 【问题诊断】指出1-2个最核心的问题
3. 【优化建议】给出2-3条具体、可执行的建议
4. 【明日日程】（仅当用户要求时）生成优化后的明日4项任务`;

export default function AIAssistant() {
  const [conversations, setConversations] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'daily_summary' | 'weekly_summary' | 'adjustment' | 'chat'>('daily_summary');
  const { isLoading, content, sendMessage, abort, setContent } = useAI();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (content) {
      setConversations(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content }];
        }
        return [...prev, { role: 'assistant', content }];
      });
    }
  }, [content]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  async function gatherContext(): Promise<string> {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');

    const [profile, todayPlan, yesterdayPlan, weekPlans, foodEntries, workoutLogs, weightRecords] = await Promise.all([
      getOrCreateProfile(),
      db.dailyPlans.where('date').equals(today).first(),
      db.dailyPlans.where('date').equals(yesterday).first(),
      db.dailyPlans.filter(p => p.date >= weekStart).toArray(),
      db.foodEntries.where('date').equals(today).toArray(),
      db.workoutLogs.where('date').equals(today).first(),
      db.weightRecords.orderBy('date').reverse().limit(7).toArray(),
    ]);

    const macros = calculateMacros(profile);
    const foodTotal = foodEntries.reduce((acc: {c: number, p: number, f: number, cb: number}, e: {calories: number, protein: number, fat: number, carbs: number}) => ({ c: acc.c + e.calories, p: acc.p + e.protein, f: acc.f + e.fat, cb: acc.cb + e.carbs }), { c: 0, p: 0, f: 0, cb: 0 });

    return `
用户档案：${profile.gender === 'male' ? '男' : '女'}，${profile.age}岁，${profile.height}cm，${profile.weight}kg
目标体重：${profile.targetWeight}kg，目标体脂：${profile.targetBodyFat}%
每日目标热量：${macros.calories}kcal，蛋白质${macros.protein}g，碳水${macros.carbs}g，脂肪${macros.fat}g

今日(${today})学习：
${todayPlan ? todayPlan.tasks.map(t => `- ${t.text}: ${t.status === 'completed' ? '完成' : t.status === 'failed' ? '未完成' : t.status === 'doing' ? '进行中' : '待做'} (${t.actualMinutes}min)`).join('\n') : '无记录'}
复盘：${todayPlan?.conquered || '无'} | 难点：${todayPlan?.difficulty || '无'}

昨日(${yesterday})学习：
${yesterdayPlan ? yesterdayPlan.tasks.map(t => `- ${t.text}: ${t.status === 'completed' ? '完成' : '未完成'} (${t.actualMinutes}min)`).join('\n') : '无记录'}

本周学习统计：
- 记录天数：${weekPlans.length}
- 完成任务：${weekPlans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'completed').length, 0)}
- 失败任务：${weekPlans.reduce((s, p) => s + p.tasks.filter(t => t.status === 'failed').length, 0)}
- 总专注时长：${weekPlans.reduce((s, p) => s + p.totalFocusMinutes, 0)}min

今日饮食：
- 热量：${foodTotal.c}/${macros.calories} kcal
- 蛋白质：${foodTotal.p.toFixed(1)}/${macros.protein}g
- 碳水：${foodTotal.cb.toFixed(1)}/${macros.carbs}g
- 脂肪：${foodTotal.f.toFixed(1)}/${macros.fat}g

今日训练：${workoutLogs ? `${workoutLogs.type}，时长${workoutLogs.duration}min` : '无记录'}

体重记录（最近7天）：
${weightRecords.map(w => `- ${w.date}: ${w.weight}kg`).join('\n')}
`;
  }

  async function handleSend() {
    if (!input.trim() && mode === 'chat') return;
    const ctx = await gatherContext();
    const userPrompt = mode === 'chat' ? input : `${mode === 'daily_summary' ? '请分析今日数据并给出优化建议' : mode === 'weekly_summary' ? '请分析本周数据并给出下周优化方案' : '请基于当前数据，生成优化后的明日日程'}

${ctx}`;

    setConversations(prev => [...prev, { role: 'user', content: userPrompt.slice(0, 200) + '...' }]);
    setInput('');
    setContent('');
    await sendMessage(SYSTEM_PROMPT, userPrompt);
  }

  return (
    <div className="space-y-4 animate-in flex flex-col h-[calc(100vh-200px)]">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            🤖 AI 教练
            <div className="flex gap-1 ml-auto">
              {[
                { key: 'daily_summary', label: '日总结' },
                { key: 'weekly_summary', label: '周总结' },
                { key: 'adjustment', label: '调日程' },
                { key: 'chat', label: '自由聊' },
              ].map(m => (
                <Button key={m.key} variant={mode === m.key ? 'default' : 'outline'} size="sm" onClick={() => setMode(m.key as any)}>
                  {m.label}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
            {conversations.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-lg mb-2">👋 我是你的AI效能教练</p>
                <p className="text-sm">选择上方模式，我会自动读取你的今日数据并给出分析建议。</p>
              </div>
            )}
            {conversations.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                  <span className="animate-pulse">思考中...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={mode === 'chat' ? '输入你想问的问题...' : '点击发送，AI会自动读取数据并分析'}
              className="flex-1 min-h-[60px]"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <div className="flex flex-col gap-2">
              <Button onClick={handleSend} disabled={isLoading}>{isLoading ? '...' : '发送'}</Button>
              {isLoading && <Button variant="outline" onClick={abort}>停止</Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
