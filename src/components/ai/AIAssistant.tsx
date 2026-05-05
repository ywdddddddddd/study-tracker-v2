import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAI } from '../../hooks/useAI';
import { db, getOrCreateProfile, calculateMacros, type Task, type DailyPlan, type WeightRecord, type SleepRecord } from '../../lib/db';
import dayjs from 'dayjs';
import { CheckSquare } from 'lucide-react';

const SYSTEM_PROMPT = `你是一位高效的个人效能管理AI教练，精通学习科学、运动营养学和认知心理学。

你的核心能力：
1. 分析用户每日/每周的执行数据（学习、健身、饮食、体重）
2. 诊断低效根源
3. 给出具体的明日优化建议
4. 当用户要求调整日程时，生成可直接执行的明日日程

分析原则：
- 学习：关注"提取率"而非"投入时长"
- 健身：关注"渐进超负荷"
- 饮食：关注"热量赤字+蛋白质达标"
- 体重：关注周趋势而非日波动

输出格式：
1. 【数据概览】用1-2句话总结关键数字
2. 【问题诊断】指出1-2个最核心的问题
3. 【优化建议】给出2-3条具体、可执行的建议
4. 【明日日程】（仅当用户要求时）生成优化后的任务列表，每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式输出，方便程序解析`;

export default function AIAssistant() {
  const [conversations, setConversations] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [mode, setMode] = useState<'daily_summary' | 'weekly_summary' | 'adjustment'>('daily_summary');
  const [adoptModalOpen, setAdoptModalOpen] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
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

    const [profile, todayPlan, yesterdayPlan, weekPlans, foodEntries, workoutLogs, weightRecords, sleepRecords] = await Promise.all([
      getOrCreateProfile(),
      db.dailyPlans.where('date').equals(today).first(),
      db.dailyPlans.where('date').equals(yesterday).first(),
      db.dailyPlans.filter(p => p.date >= weekStart).toArray(),
      db.foodEntries.where('date').equals(today).toArray(),
      db.workoutLogs.where('date').equals(today).first(),
      db.weightRecords.orderBy('date').reverse().limit(7).toArray(),
      db.sleepRecords.orderBy('date').reverse().limit(7).toArray(),
    ]);

    const macros = calculateMacros(profile);
    const foodTotal = foodEntries.reduce((acc: {c: number, p: number, f: number, cb: number}, e: {calories: number, protein: number, fat: number, carbs: number}) => ({ c: acc.c + e.calories, p: acc.p + e.protein, f: acc.f + e.fat, cb: acc.cb + e.carbs }), { c: 0, p: 0, f: 0, cb: 0 });

    return `
用户档案：${profile.gender === 'male' ? '男' : '女'}，${profile.age}岁，${profile.height}cm，${profile.weight}kg
目标体重：${profile.targetWeight}kg，目标体脂：${profile.targetBodyFat}%
每日目标热量：${macros.calories}kcal，蛋白质${macros.protein}g，碳水${macros.carbs}g，脂肪${macros.fat}g

今日(${today})学习：
${todayPlan ? todayPlan.tasks.map((t: Task) => `- ${t.text}: ${t.status === 'completed' ? '完成' : t.status === 'failed' ? '未完成' : t.status === 'doing' ? '进行中' : '待做'} (${t.actualMinutes}min)`).join('\n') : '无记录'}
复盘：${todayPlan?.conquered || '无'} | 难点：${todayPlan?.difficulty || '无'}

昨日(${yesterday})学习：
${yesterdayPlan ? yesterdayPlan.tasks.map((t: Task) => `- ${t.text}: ${t.status === 'completed' ? '完成' : '未完成'} (${t.actualMinutes}min)`).join('\n') : '无记录'}

本周学习统计：
- 记录天数：${weekPlans.length}
- 完成任务：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'completed').length, 0)}
- 失败任务：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'failed').length, 0)}
- 总专注时长：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.totalFocusMinutes, 0)}min

今日饮食：
- 热量：${foodTotal.c}/${macros.calories} kcal
- 蛋白质：${foodTotal.p.toFixed(1)}/${macros.protein}g
- 碳水：${foodTotal.cb.toFixed(1)}/${macros.carbs}g
- 脂肪：${foodTotal.f.toFixed(1)}/${macros.fat}g

今日训练：${workoutLogs ? `${workoutLogs.type}，时长${workoutLogs.duration}min` : '无记录'}

体重记录（最近7天）：
${weightRecords.map((w: WeightRecord) => `- ${w.date}: ${w.weight}kg`).join('\n')}

睡眠记录（最近7天）：
${sleepRecords.map((s: SleepRecord) => `- ${s.date}: ${s.bedTime}-${s.wakeTime}, ${Math.floor(s.duration / 60)}h${s.duration % 60}m, 质量${s.quality}/5`).join('\n')}
`;
  }

  async function handleSend() {
    const ctx = await gatherContext();
    const userPrompt = mode === 'daily_summary' ? '请分析今日数据并给出优化建议' :
      mode === 'weekly_summary' ? '请分析本周数据并给出下周优化方案' :
      '请基于当前数据，生成优化后的明日日程，每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式输出';

    setConversations(prev => [...prev, { role: 'user', content: userPrompt }]);
    setContent('');
    await sendMessage(SYSTEM_PROMPT, `${userPrompt}\n\n${ctx}`);
  }

  function parseSuggestedTasks(text: string): Task[] {
    const tasks: Task[] = [];
    const regex = /[「【]([^|]+)\|([^|]+)\|(\d+)[」\]]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const category = match[2].trim() as 'english' | 'dental' | 'other';
      if (['english', 'dental', 'other'].includes(category)) {
        tasks.push({
          id: `ai-${Date.now()}-${tasks.length}`,
          text: match[1].trim(),
          category,
          status: 'pending',
          plannedMinutes: parseInt(match[3]),
          actualMinutes: 0,
          timerAccumulated: 0,
        });
      }
    }
    return tasks;
  }

  function openAdopt() {
    const lastAssistant = [...conversations].reverse().find(c => c.role === 'assistant');
    if (!lastAssistant) return;
    const tasks = parseSuggestedTasks(lastAssistant.content);
    if (tasks.length === 0) {
      alert('未检测到可解析的任务，请确保AI输出中包含「任务名|分类|分钟数」格式的任务');
      return;
    }
    setSuggestedTasks(tasks);
    setSelectedTasks(new Set(tasks.map((_, i) => i)));
    setAdoptModalOpen(true);
  }

  async function confirmAdopt() {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const existing = await db.dailyPlans.where('date').equals(tomorrow).first();
    const toAdopt = suggestedTasks.filter((_, i) => selectedTasks.has(i));
    if (existing) {
      const merged = [...existing.tasks, ...toAdopt];
      await db.dailyPlans.put({ ...existing, tasks: merged });
    } else {
      await db.dailyPlans.put({
        date: tomorrow,
        tasks: toAdopt,
        conquered: '',
        difficulty: '',
        adjust: '',
        completion: '',
        totalFocusMinutes: 0,
      });
    }
    setAdoptModalOpen(false);
    alert(`✅ 已采纳 ${toAdopt.length} 项任务到明日计划`);
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
          <div className="flex gap-2 flex-wrap">
            {mode === 'adjustment' && conversations.some(c => c.role === 'assistant') && !isLoading && (
              <Button variant="secondary" onClick={openAdopt} className="shrink-0">
                <CheckSquare className="w-4 h-4 mr-1" /> 采纳AI建议
              </Button>
            )}
            <Button onClick={handleSend} disabled={isLoading} className="ml-auto">{isLoading ? '...' : '发送'}</Button>
            {isLoading && <Button variant="outline" onClick={abort}>停止</Button>}
          </div>
        </CardContent>
      </Card>

      {adoptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdoptModalOpen(false)}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">采纳AI建议到明日计划</h3>
            <div className="space-y-2 mb-4">
              {suggestedTasks.map((task, i) => (
                <label key={i} className="flex items-start gap-2 p-2 border rounded-lg cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(i)}
                    onChange={e => {
                      const next = new Set(selectedTasks);
                      if (e.target.checked) next.add(i); else next.delete(i);
                      setSelectedTasks(next);
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{task.text}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.category === 'english' ? '英语' : task.category === 'dental' ? '专业课' : '其它'} | 预计 {task.plannedMinutes} 分钟
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdoptModalOpen(false)}>取消</Button>
              <Button onClick={confirmAdopt}>确认采纳 ({selectedTasks.size}项)</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
