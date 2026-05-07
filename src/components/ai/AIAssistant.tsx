import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAI } from '../../hooks/useAI';
import { getOrCreateProfile, calculateMacros, type Task, type FoodEntry, getDailyPlan, saveDailyPlan, getDailyPlansInRange, getFoodEntries, getWorkoutLog, getWeightRecords, getSleepRecords, getFoodEntriesInRange, getWorkoutLogsInRange, getWeeklyReview, getGymSchedules } from '../../lib/db';
import type { WorkoutLog } from '../../types';
import { GYM_SCHEDULE } from '../../data/presets';
import dayjs from 'dayjs';
import { CheckSquare, Brain, Calendar, Send, Sun, Moon } from 'lucide-react';

const SYSTEM_PROMPT = `你是wen的AI日程助手，精通学习科学、运动营养学和认知心理学。

你的能力：
1. /饮食 — 分析饮食摄入数据，诊断营养问题，给出具体餐食建议
2. /健身 — 分析训练数据，评估渐进超负荷，给出训练调整建议
3. /学习 — 分析学习效率，诊断低效根源，给出学习方法优化
4. /日程 — 基于本周预算配额，生成优化后的明日/下周完整安排
5. /日 or /周 — 日常/周度综合总结分析
6. /分析 — 全链条分析：饮食→健身→学习→日程安排，聚合后再执行

分析原则：
- 学习：关注"提取率"而非"投入时长"
- 健身：关注"渐进超负荷"
- 饮食：关注"热量赤字+蛋白质达标"，蛋白质按每公斤目标体重2.2g
- 体重：关注周趋势而非日波动

输出要求：
- 用Markdown格式，分结构清晰的章节
- 生成日程时，每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式
- 饮食建议具体到每餐的食物和数量
- 训练安排参考健身日程表`;

export default function AIAssistant() {
  const [conversations, setConversations] = useState<{ role: 'user' | 'assistant'; content: string; reasoning?: string }[]>([]);
  const [adoptModalOpen, setAdoptModalOpen] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [showReasoning, setShowReasoning] = useState<Set<number>>(new Set());
  const { isLoading, content, reasoning, sendMessage, abort, setContent, setReasoning } = useAI();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dataStart, setDataStart] = useState('2026-05-05');
  const [dataEnd, setDataEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [scope, setScope] = useState<'day' | 'week'>('day');
  const [userInput, setUserInput] = useState('');

  // CoT fix: track reasoning per conversation index
  useEffect(() => {
    if (content || reasoning) {
      setConversations(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content, reasoning }];
        }
        return [...prev, { role: 'assistant', content, reasoning }];
      });
    }
  }, [content, reasoning]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversations]);

  function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
    let cardioTotal = 0;
    for (const ex of w.exercises) {
      if (ex.kind === 'cardio' && ex.cardioParams) {
        const speed = ex.cardioParams.speed || 0; const incline = ex.cardioParams.incline || 0;
        const duration = ex.cardioParams.duration || 0;
        const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
        cardioTotal += mets * weightKg * (duration / 60);
      }
    }
    const cd = w.exercises.filter(e => e.kind === 'cardio').reduce((s, e) => s + (e.cardioParams?.duration || 0), 0);
    const sd = Math.max(0, (w.duration || 0) - cd);
    return Math.round(cardioTotal + (sd > 0 ? 4.5 * weightKg * (sd / 60) : 0));
  }
  function calculateBMR(w: number, h: number, a: number, g: string): number {
    return g === 'male' ? Math.round(10*w + 6.25*h - 5*a + 5) : Math.round(10*w + 6.25*h - 5*a - 161);
  }

  async function gatherContext(): Promise<string> {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

    const [profile, todayPlan, rangePlans, foodEntries, workoutLogs,
      yesterdayFoods, twoDaysAgoFoods, rangeFoodEntries, rangeWorkouts, weightRecords, sleepRecords, weekReview, gymOverrides] = await Promise.all([
      getOrCreateProfile(), getDailyPlan(today),
      getDailyPlansInRange(dataStart, dataEnd), getFoodEntries(today), getWorkoutLog(today),
      getFoodEntries(yesterday), getFoodEntries(twoDaysAgo),
      getFoodEntriesInRange(dataStart, dataEnd), getWorkoutLogsInRange(dataStart, dataEnd),
      getWeightRecords('desc').then(a => a.slice(0, 14)), getSleepRecords(14).then(a => a.reverse()),
      getWeeklyReview(dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD')),
      getGymSchedules().catch(() => []),
    ]);

    const macros = calculateMacros(profile);
    const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

    const foodTotal = (entries: FoodEntry[]) => entries.reduce((a, e) => ({ c: a.c + e.calories, p: a.p + e.protein, f: a.f + e.fat, cb: a.cb + e.carbs }), { c: 0, p: 0, f: 0, cb: 0 });
    const ft = foodTotal(foodEntries);
    const workoutBurn = workoutLogs ? calcWorkoutBurn(workoutLogs, profile.weight) : 0;

    const rangeFT = foodTotal(rangeFoodEntries);
    const rangeWB = rangeWorkouts.reduce((s: number, w: WorkoutLog) => s + calcWorkoutBurn(w, profile.weight), 0);

    // Gym schedule
    const overrideMap: Record<string, string> = {};
    for (const o of gymOverrides) overrideMap[o.date] = o.gym;
    const gymScheduleText = GYM_SCHEDULE.slice(0, 7).map(s => {
      const gym = overrideMap[s.date] || s.gym;
      return `- ${s.date} ${s.weekday}: ${gym}`;
    }).join('\n');

    // Food details helper
    const mealLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
    const formatFoods = (entries: FoodEntry[], label: string) => {
      if (entries.length === 0) return `${label}: 无记录`;
      const byMeal: Record<string, FoodEntry[]> = {};
      for (const f of entries) { if (!byMeal[f.meal]) byMeal[f.meal] = []; byMeal[f.meal].push(f); }
      return Object.entries(byMeal).map(([m, items]) => {
        const t = items.reduce((s, e) => s + e.calories, 0);
        return `${mealLabels[m] || m} (${t}kcal):\n${items.map(e => `  - ${e.name} ${e.weight}g (${e.calories}kcal, P${e.protein}g C${e.carbs}g F${e.fat}g)`).join('\n')}`;
      }).join('\n') || `${label}: 无记录`;
    };

    // Budget tracking
    const catBudget: Record<string, number> = { dental: (weekReview?.budgetDental || 10.5) * 60, english: (weekReview?.budgetEnglish || 7) * 60, other: (weekReview?.budgetReview || 2) * 60 };
    const catUsed: Record<string, number> = { dental: 0, english: 0, other: 0 };
    for (const p of rangePlans) for (const t of p.tasks) if (t.status === 'completed') catUsed[t.category] = (catUsed[t.category] || 0) + (t.actualMinutes || 0);
    const daysRemaining = Math.max(1, 7 - rangePlans.length);
    const budgetLines = ['dental', 'english', 'other'].map(cat => {
      const u = Math.round(catUsed[cat] || 0), t = catBudget[cat] || 0, r = Math.max(0, t - u);
      return `- ${cat === 'dental' ? '专业课' : cat === 'english' ? '英语' : '其它'}: 已用${u}min/${t}min, 剩余${r}min, 建议每日${Math.round(r/daysRemaining)}min`;
    }).join('\n');

    const weightTrend = weightRecords.length >= 2 ? weightRecords[weightRecords.length-1].weight - weightRecords[0].weight : 0;

    return `=== 用户档案 ===
性别：${profile.gender === 'male' ? '男' : '女'}，年龄${profile.age}岁，身高${profile.height}cm，当前体重${profile.weight}kg
目标体重：${profile.targetWeight}kg，目标体脂：${profile.targetBodyFat}%
BMR：${bmr} kcal/天，目标热量：${macros.calories}kcal，P${macros.protein}g C${macros.carbs}g F${macros.fat}g

=== 健身日程表（近7天）===
${gymScheduleText}

=== 今日学习(${today}) ===
${todayPlan ? todayPlan.tasks.map((t: Task) => {
  const eff = t.completionRate !== undefined ? `${t.completionRate}%` : (t.status === 'completed' ? '100%' : 'N/A');
  return `- ${t.text}: ${t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⬜'} 效率${eff} 实际${t.actualMinutes}min/预计${t.plannedMinutes}min${t.reason ? ` [${t.reason}]` : ''}`;
}).join('\n') : '无记录'}
总专注：${todayPlan?.totalFocusMinutes || 0}min | 复盘：${todayPlan?.conquered || '无'} | 难点：${todayPlan?.difficulty || '无'}

=== 今日饮食 ===
${formatFoods(foodEntries, '今日')}
今日总计：${ft.c}kcal P${ft.p.toFixed(1)} C${ft.cb.toFixed(1)} F${ft.f.toFixed(1)}
目标：${macros.calories}kcal P${macros.protein}g C${macros.carbs}g F${macros.fat}g

=== 昨日饮食(${yesterday}) ===
${formatFoods(yesterdayFoods, '昨日')}

=== 前日饮食(${twoDaysAgo}) ===
${formatFoods(twoDaysAgoFoods, '前日')}

=== 今日训练 ===
${workoutLogs ? `类型：${workoutLogs.type}，时长${workoutLogs.duration}min，运动消耗${workoutBurn}kcal，总消耗${workoutBurn + bmr}kcal
动作：
${workoutLogs.exercises.map(ex => ex.kind === 'cardio' ? `  - ${ex.name}: 有氧 ${ex.cardioParams?.duration || 0}min @${ex.cardioParams?.speed || 0}km/h` : `  - ${ex.name}: 力量 ${ex.sets.length}组 (${ex.sets.map(s => `${s.reps}次${s.weight>0?`${s.weight}kg`:''}`).join(', ')})`).join('\n')}` : '无训练记录'}

=== 范围统计(${dataStart}~${dataEnd}) ===
记录：${rangePlans.length}天 | 完成任务：${rangePlans.reduce((s,p) => s + p.tasks.filter(t => t.status === 'completed').length, 0)} | 失败：${rangePlans.reduce((s,p) => s + p.tasks.filter(t => t.status === 'failed').length, 0)}
总专注：${rangePlans.reduce((s,p) => s + p.totalFocusMinutes, 0)}min
总摄入：${rangeFT.c}kcal P${rangeFT.p.toFixed(1)} C${rangeFT.cb.toFixed(1)} F${rangeFT.f.toFixed(1)}
总训练消耗：${rangeWB}kcal | 预估赤字：${rangeWB + bmr*rangePlans.length - rangeFT.c}kcal

=== 本周预算 ===
${budgetLines}
目标：${weekReview?.taskGoals || '无'} | 进度：${weekReview?.progressGoals || '无'}
运动配额：${weekReview?.budgetSport || 3.5}h/周

=== 体重（14天）===
${weightRecords.map(w => `- ${w.date}: ${w.weight}kg${w.bodyFat?` (体脂${w.bodyFat}%)`:''}`).join('\n')}
趋势：${weightTrend > 0 ? '↑' : weightTrend < 0 ? '↓' : '→'} ${Math.abs(weightTrend).toFixed(1)}kg

=== 睡眠（14天）===
${sleepRecords.map(s => `- ${s.date}: ${s.bedTime}→${s.wakeTime} ${Math.floor(s.duration/60)}h${s.duration%60}m ★${s.quality}`).join('\n')}
`;
  }

  async function handleSend(text?: string) {
    const input = text || userInput;
    if (!input.trim() || isLoading) return;
    const ctx = await gatherContext();

    // Parse command
    let cmd = 'daily_summary';
    if (/\/饮食/.test(input)) cmd = 'nutrition';
    else if (/\/健身/.test(input)) cmd = 'fitness';
    else if (/\/学习/.test(input)) cmd = 'study';
    else if (/\/日程|\/安排/.test(input)) cmd = 'adjustment';
    else if (/\/周/.test(input)) cmd = 'weekly_summary';
    else if (/\/日/.test(input)) cmd = 'daily_summary';
    else if (/\/分析/.test(input)) cmd = 'auto_setup';

    const cmdHints: Record<string, string> = {
      nutrition: '请深入分析饮食数据，诊断营养问题，给出每餐具体食物调整建议',
      fitness: '请分析训练数据，评估渐进超负荷进展，给出训练调整建议',
      study: '请分析学习数据，诊断效率问题，给出学习方法优化建议',
      adjustment: '请基于预算配额和健身日程，生成明日完整安排。学习任务用「任务名|分类|预计分钟数」格式，饮食具体到每餐食物，训练参考健身日程',
      auto_setup: '请做全链条分析：先饮食→再健身→再学习→最后综合安排。每步独立分析完成后，最后汇总生成明日完整安排',
    };
    // Format reminder suffix for schedule commands
    const fmtReminder = cmd === 'adjustment' || cmd === 'auto_setup'
      ? '\n\n【重要】请确保学习任务严格使用格式：「任务名|分类|预计分钟数」。例如：「背单词100个|english|45」。分类只能填 english/dental/other 三个值。'
      : '';

    setConversations(prev => [...prev, { role: 'user', content: input }]);
    setUserInput('');
    setContent('');
    setReasoning('');
    await sendMessage(SYSTEM_PROMPT, `${cmdHints[cmd] || cmdHints.daily_summary}${fmtReminder}\n\n用户输入: ${input}\n\n${ctx}`);
  }

  function parseSuggestedTasks(text: string): Task[] {
    const tasks: Task[] = [];
    const seen = new Set<string>();
    // Try multiple format patterns
    const patterns = [
      /[「【]([^|]+)\|([^|]+)\|(\d+)[」\]】]/g,      // 「任务名|分类|分钟数」
      /(\S.+?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/g,  // 任务名|english|45  (bare pipe)
      /-\s*(\S.+?)\s*[|｜]\s*(english|dental|other)\s*[|｜]\s*(\d+)/g, // - 任务名|分类|分钟
    ];
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const text = match[1].trim();
        const cat = match[2].trim() as 'english' | 'dental' | 'other';
        const mins = parseInt(match[3]);
        const key = `${text}|${cat}`;
        if (!seen.has(key) && mins > 0) {
          seen.add(key);
          tasks.push({ id: `ai-${Date.now()}-${tasks.length}`, text, category: cat, status: 'pending', plannedMinutes: mins, actualMinutes: 0, timerAccumulated: 0 });
        }
      }
    }
    return tasks;
  }

  function openAdopt() {
    const lastAssistant = [...conversations].reverse().find(c => c.role === 'assistant');
    if (!lastAssistant) return;
    const tasks = parseSuggestedTasks(lastAssistant.content);
    if (tasks.length === 0) { alert('未检测到可解析的任务格式'); return; }
    setSuggestedTasks(tasks);
    setSelectedTasks(new Set(tasks.map((_, i) => i)));
    setAdoptModalOpen(true);
  }

  async function confirmAdopt() {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const existing = await getDailyPlan(tomorrow);
    const toAdopt = suggestedTasks.filter((_, i) => selectedTasks.has(i));
    if (existing) { await saveDailyPlan({ ...existing, tasks: [...existing.tasks, ...toAdopt] }); }
    else { await saveDailyPlan({ date: tomorrow, tasks: toAdopt, conquered: '', difficulty: '', adjust: '', completion: '', totalFocusMinutes: 0 }); }
    setAdoptModalOpen(false);
    alert(`✅ 已采纳 ${toAdopt.length} 项任务到明日计划`);
  }

  return (
    <div className="space-y-4 animate-in flex flex-col h-[calc(100vh-200px)]">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            <span>AI助手</span>
            {/* Day/Week toggle */}
            <div className="flex items-center gap-1 ml-auto bg-muted rounded-lg p-0.5">
              <button onClick={() => setScope('day')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${scope === 'day' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`}>
                <Sun className="w-3 h-3 inline mr-1" />日
              </button>
              <button onClick={() => setScope('week')} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${scope === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`}>
                <Moon className="w-3 h-3 inline mr-1" />周
              </button>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <Input type="date" value={dataStart} onChange={e => setDataStart(e.target.value)} className="w-auto h-7 text-xs px-2" />
            <span className="text-xs text-muted-foreground">至</span>
            <Input type="date" value={dataEnd} onChange={e => setDataEnd(e.target.value)} className="w-auto h-7 text-xs px-2" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
            {conversations.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-lg mb-2">👋 我是你的AI助手</p>
                <p className="text-sm mb-1">输入 <code className="bg-muted px-1 rounded">/饮食</code> <code className="bg-muted px-1 rounded">/健身</code> <code className="bg-muted px-1 rounded">/学习</code> <code className="bg-muted px-1 rounded">/日程</code> <code className="bg-muted px-1 rounded">/分析</code> 开始</p>
                <p className="text-xs text-muted-foreground">当前模型: DeepSeek V4 Pro</p>
              </div>
            )}
            {conversations.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="markdown-body text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                      {msg.reasoning && (
                        <div className="mt-2 border-t pt-2">
                          <button onClick={() => { const n = new Set(showReasoning); if (n.has(i)) n.delete(i); else n.add(i); setShowReasoning(n); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Brain className="w-3 h-3" /> {showReasoning.has(i) ? '隐藏思考' : '查看思考'}
                          </button>
                          {showReasoning.has(i) && (
                            <div className="mt-1 bg-background/50 rounded p-2 text-xs text-muted-foreground border whitespace-pre-wrap">{msg.reasoning}</div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b pb-3 mb-2">
                <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                  <span className="animate-pulse font-medium">{reasoning ? '🧠 深度思考中...' : content ? '生成中...' : '连接中...'}</span>
                  {reasoning && (
                    <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto border-t pt-2">{reasoning}</div>
                  )}
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
          {/* Input area */}
          <div className="flex gap-2 flex-wrap">
            {conversations.some(c => c.role === 'assistant') && !isLoading && (() => {
              const lastMsg = [...conversations].reverse().find(c => c.role === 'assistant');
              const hasTasks = lastMsg && parseSuggestedTasks(lastMsg.content).length > 0;
              return hasTasks ? (
                <Button variant="secondary" onClick={openAdopt} className="shrink-0">
                  <CheckSquare className="w-4 h-4 mr-1" /> 采纳任务
                </Button>
              ) : null;
            })()}
            <div className="flex-1 flex gap-2">
              <Input
                ref={inputRef}
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`输入 /饮食 /健身 /学习 /日程 /分析... (Enter发送)`}
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={() => handleSend()} disabled={isLoading || !userInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
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
                  <input type="checkbox" checked={selectedTasks.has(i)} onChange={e => { const n = new Set(selectedTasks); if (e.target.checked) n.add(i); else n.delete(i); setSelectedTasks(n); }} className="mt-1" />
                  <div className="flex-1"><div className="font-medium">{task.text}</div>
                    <div className="text-xs text-muted-foreground">{task.category === 'english' ? '英语' : task.category === 'dental' ? '专业课' : '其它'} | 预计 {task.plannedMinutes} 分钟</div>
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
