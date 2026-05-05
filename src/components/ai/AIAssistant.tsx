import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAI } from '../../hooks/useAI';
import { getOrCreateProfile, calculateMacros, type Task, type DailyPlan, type WeightRecord, type SleepRecord, getDailyPlan, saveDailyPlan, getDailyPlansInRange, getFoodEntries, getWorkoutLog, getWeightRecords, getSleepRecords, getFoodEntriesInRange, getWorkoutLogsInRange, getAllDailyPlans } from '../../lib/db';
import type { WorkoutLog } from '../../types';
import dayjs from 'dayjs';
import { CheckSquare, Brain } from 'lucide-react';

const AGENT_PROMPTS: Record<string, string> = {
  daily_summary: `你是一位高效的个人效能管理AI教练，精通学习科学、运动营养学和认知心理学。

你的核心能力：
1. 分析用户每日/每周的执行数据（学习、健身、饮食、体重）
2. 诊断低效根源
3. 给出具体的明日优化建议

分析原则：
- 学习：关注"提取率"而非"投入时长"
- 健身：关注"渐进超负荷"
- 饮食：关注"热量赤字+蛋白质达标"
- 体重：关注周趋势而非日波动

输出格式：
1. 【数据概览】用1-2句话总结关键数字
2. 【问题诊断】指出1-2个最核心的问题
3. 【优化建议】给出2-3条具体、可执行的建议`,
  weekly_summary: `你是一位高效的个人效能管理AI教练，精通学习科学、运动营养学和认知心理学。

你的核心能力：
1. 分析用户本周的执行数据（学习、健身、饮食、体重）
2. 诊断低效根源
3. 给出下周优化方案

分析原则：
- 学习：关注"提取率"而非"投入时长"
- 健身：关注"渐进超负荷"
- 饮食：关注"热量赤字+蛋白质达标"
- 体重：关注周趋势而非日波动

输出格式：
1. 【本周数据概览】用1-2句话总结关键数字
2. 【本周问题诊断】指出1-2个最核心的问题
3. 【下周优化方案】给出2-3条具体、可执行的建议`,
  adjustment: `你是一位高效的个人效能管理AI教练，精通学习科学、运动营养学和认知心理学。

你的核心能力：
1. 基于用户当前数据生成优化后的明日日程
2. 考虑用户的健身计划、学习进度和体力恢复

生成原则：
- 根据今日完成情况调整明日任务量
- 考虑健身日和休息日的不同安排
- 保持英语/专业课/其它的合理比例

输出格式：
1. 【明日日程建议】列出优化后的任务列表
2. 每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式输出，方便程序解析`,
  nutrition: `你是一位运动营养学专家，精通减脂期饮食规划。

你的核心能力：
1. 分析用户每日/每周的饮食数据
2. 诊断营养摄入问题
3. 给出具体的饮食调整建议

分析原则：
- 蛋白质：每公斤目标体重2.2g
- 热量赤字：TDEE - 500~1000 kcal
- 食物质量：优先全食物，控制加工食品
- 进餐时机：训练前后营养分配

输出格式：
1. 【饮食数据概览】总结今日/本周关键数字
2. 【问题诊断】指出营养摄入问题
3. 【优化建议】给出具体饮食调整方案`,
  fitness: `你是一位力量训练和体能训练专家，精通渐进超负荷和周期化训练。

你的核心能力：
1. 分析用户训练数据
2. 诊断训练问题
3. 给出训练调整建议

分析原则：
- 渐进超负荷：逐步增加重量/次数/容量
- 恢复管理：关注训练频率和休息日质量
- 动作质量：优先控制，其次重量
- 有氧安排：与力量训练的时间分配

输出格式：
1. 【训练数据概览】总结训练情况
2. 【问题诊断】指出训练问题
3. 【优化建议】给出具体训练调整方案`,
  study: `你是一位学习科学专家，精通认知心理学和高效学习法。

你的核心能力：
1. 分析用户学习数据
2. 诊断学习效率问题
3. 给出学习方法优化建议

分析原则：
- 主动回忆 > 重复阅读
- 分散学习 > 集中学习
- 交错练习 > 单一练习
- 深度加工 > 表面加工

输出格式：
1. 【学习数据概览】总结学习情况
2. 【问题诊断】指出学习效率问题
3. 【优化建议】给出具体学习方法改进`,
};

export default function AIAssistant() {
  const [conversations, setConversations] = useState<{ role: 'user' | 'assistant'; content: string; reasoning?: string }[]>([]);
  const [mode, setMode] = useState<'daily_summary' | 'weekly_summary' | 'adjustment' | 'nutrition' | 'fitness' | 'study'>('daily_summary');
  const [adoptModalOpen, setAdoptModalOpen] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [showReasoning, setShowReasoning] = useState<Set<number>>(new Set());
  const { isLoading, content, reasoning, sendMessage, abort, setContent, setReasoning } = useAI();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (content) {
      setConversations(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content, reasoning }];
        }
        return [...prev, { role: 'assistant', content, reasoning }];
      });
    }
  }, [content, reasoning]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations]);

  function calcWorkoutBurn(w: WorkoutLog, weightKg: number): number {
    let total = 0;
    for (const ex of w.exercises) {
      if (ex.kind === 'cardio' && ex.cardioParams) {
        const speed = ex.cardioParams.speed || 0;
        const incline = ex.cardioParams.incline || 0;
        const duration = ex.cardioParams.duration || 0;
        const mets = (speed * 0.2 + incline * 0.9 + 3.5) / 3.5;
        total += mets * weightKg * (duration / 60);
      } else if (ex.kind === 'strength') {
        const strengthCount = w.exercises.filter(e => e.kind === 'strength').length || 1;
        const share = (w.duration || 60) / strengthCount;
        total += 4.5 * weightKg * (share / 60);
      }
    }
    return Math.round(total);
  }

  function calculateBMR(weight: number, height: number, age: number, gender: string): number {
    if (gender === 'male') {
      return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    }
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }

  async function gatherContext(): Promise<string> {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').add(1, 'day').format('YYYY-MM-DD');
    const monthStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

    const [profile, todayPlan, yesterdayPlan, weekPlans, monthPlans, foodEntries, workoutLogs, weekFoodEntries, weekWorkouts, weightRecords, sleepRecords, allPlans] = await Promise.all([
      getOrCreateProfile(),
      getDailyPlan(today),
      getDailyPlan(yesterday),
      getDailyPlansInRange(weekStart, today),
      getDailyPlansInRange(monthStart, today),
      getFoodEntries(today),
      getWorkoutLog(today),
      getFoodEntriesInRange(weekStart, today),
      getWorkoutLogsInRange(weekStart, today),
      getWeightRecords('desc').then(arr => arr.slice(0, 14)),
      getSleepRecords(14).then(arr => arr.reverse()),
      getAllDailyPlans(),
    ]);

    const macros = calculateMacros(profile);
    const foodTotal = foodEntries.reduce((acc: {c: number, p: number, f: number, cb: number}, e: {calories: number, protein: number, fat: number, carbs: number}) => ({ c: acc.c + e.calories, p: acc.p + e.protein, f: acc.f + e.fat, cb: acc.cb + e.carbs }), { c: 0, p: 0, f: 0, cb: 0 });
    const workoutBurn = workoutLogs ? calcWorkoutBurn(workoutLogs, profile.weight) : 0;
    const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

    // Weekly aggregates
    const weekFoodTotal = weekFoodEntries.reduce((acc: {c: number, p: number, f: number, cb: number}, e: {calories: number, protein: number, fat: number, carbs: number}) => ({ c: acc.c + e.calories, p: acc.p + e.protein, f: acc.f + e.fat, cb: acc.cb + e.carbs }), { c: 0, p: 0, f: 0, cb: 0 });
    const weekWorkoutBurn = weekWorkouts.reduce((s: number, w: WorkoutLog) => s + calcWorkoutBurn(w, profile.weight), 0);

    // Monthly aggregates
    const monthCompletedTasks = monthPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'completed').length, 0);
    const monthFailedTasks = monthPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'failed').length, 0);
    const monthTotalFocus = monthPlans.reduce((s: number, p: DailyPlan) => s + p.totalFocusMinutes, 0);

    // All time stats
    const totalCompletedAllTime = allPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'completed').length, 0);
    const totalFailedAllTime = allPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'failed').length, 0);
    const totalFocusAllTime = allPlans.reduce((s: number, p: DailyPlan) => s + p.totalFocusMinutes, 0);

    // Weight trend
    const weightTrend = weightRecords.length >= 2
      ? weightRecords[0].weight - weightRecords[weightRecords.length - 1].weight
      : 0;

    return `
=== 用户档案 ===
性别：${profile.gender === 'male' ? '男' : '女'}，年龄${profile.age}岁，身高${profile.height}cm，当前体重${profile.weight}kg
目标体重：${profile.targetWeight}kg，目标体脂：${profile.targetBodyFat}%
基础代谢(BMR)：${bmr} kcal/天
每日目标热量：${macros.calories}kcal，蛋白质${macros.protein}g，碳水${macros.carbs}g，脂肪${macros.fat}g

=== 今日(${today})学习 ===
${todayPlan ? todayPlan.tasks.map((t: Task) => `- ${t.text}: ${t.status === 'completed' ? '完成' : t.status === 'failed' ? '未完成' : t.status === 'doing' ? '进行中' : '待做'} (${t.actualMinutes}min) [${t.category === 'english' ? '英语' : t.category === 'dental' ? '专业课' : '其它'}]`).join('\n') : '无记录'}
总专注时长：${todayPlan?.totalFocusMinutes || 0}min
复盘：${todayPlan?.conquered || '无'} | 难点：${todayPlan?.difficulty || '无'} | 调整：${todayPlan?.adjust || '无'}

=== 昨日(${yesterday})学习 ===
${yesterdayPlan ? yesterdayPlan.tasks.map((t: Task) => `- ${t.text}: ${t.status === 'completed' ? '完成' : '未完成'} (${t.actualMinutes}min)`).join('\n') : '无记录'}

=== 本周统计(${weekStart}~${today}) ===
记录天数：${weekPlans.length}
完成任务：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'completed').length, 0)}
失败任务：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.tasks.filter((t: Task) => t.status === 'failed').length, 0)}
总专注时长：${weekPlans.reduce((s: number, p: DailyPlan) => s + p.totalFocusMinutes, 0)}min

=== 今日饮食 ===
热量：${foodTotal.c}/${macros.calories} kcal
蛋白质：${foodTotal.p.toFixed(1)}/${macros.protein}g
碳水：${foodTotal.cb.toFixed(1)}/${macros.carbs}g
脂肪：${foodTotal.f.toFixed(1)}/${macros.fat}g

=== 今日训练 ===
${workoutLogs ? `类型：${workoutLogs.type}，时长${workoutLogs.duration}min，运动消耗约${workoutBurn}kcal，总消耗(含BMR)约${workoutBurn + bmr}kcal` : '无训练记录'}

=== 本周饮食汇总 ===
总摄入：${weekFoodTotal.c} kcal
总消耗：${weekWorkoutBurn + bmr * weekPlans.length} kcal (运动${weekWorkoutBurn} + BMR${bmr}*${weekPlans.length}天)
平均每日摄入：${weekPlans.length > 0 ? Math.round(weekFoodTotal.c / weekPlans.length) : 0} kcal

=== 本月统计(${monthStart}~${today}) ===
记录天数：${monthPlans.length}
完成任务：${monthCompletedTasks}
失败任务：${monthFailedTasks}
总专注时长：${monthTotalFocus}min

=== 全部历史统计 ===
总完成任务：${totalCompletedAllTime}
总失败任务：${totalFailedAllTime}
总专注时长：${totalFocusAllTime}min

=== 体重记录（最近14天）===
${weightRecords.map((w: WeightRecord) => `- ${w.date}: ${w.weight}kg${w.bodyFat ? ` (体脂${w.bodyFat}%)` : ''}`).join('\n')}
体重趋势：${weightTrend > 0 ? '上升' : '下降'} ${Math.abs(weightTrend).toFixed(1)}kg

=== 睡眠记录（最近14天）===
${sleepRecords.map((s: SleepRecord) => `- ${s.date}: ${s.bedTime}-${s.wakeTime}, ${Math.floor(s.duration / 60)}h${s.duration % 60}m, 质量${s.quality}/5`).join('\n')}
`;
  }

  async function handleSend() {
    const ctx = await gatherContext();
    const systemPrompt = AGENT_PROMPTS[mode] || AGENT_PROMPTS.daily_summary;
    const userPrompt = mode === 'daily_summary' ? '请分析今日数据并给出优化建议' :
      mode === 'weekly_summary' ? '请分析本周数据并给出下周优化方案' :
      mode === 'adjustment' ? '请基于当前数据，生成优化后的明日日程，每条任务用「任务名|分类(english/dental/other)|预计分钟数」格式输出' :
      mode === 'nutrition' ? '请分析今日/本周饮食数据并给出优化建议' :
      mode === 'fitness' ? '请分析今日/本周训练数据并给出优化建议' :
      '请分析今日/本周学习数据并给出优化建议';

    setConversations(prev => [...prev, { role: 'user', content: userPrompt }]);
    setContent('');
    setReasoning('');
    await sendMessage(systemPrompt, `${userPrompt}\n\n${ctx}`);
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
    const existing = await getDailyPlan(tomorrow);
    const toAdopt = suggestedTasks.filter((_, i) => selectedTasks.has(i));
    if (existing) {
      const merged = [...existing.tasks, ...toAdopt];
      await saveDailyPlan({ ...existing, tasks: merged });
    } else {
      await saveDailyPlan({
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
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            <span>🤖 AI 教练</span>
            <div className="flex gap-1 ml-auto flex-wrap">
              {[
                { key: 'daily_summary', label: '日总结' },
                { key: 'weekly_summary', label: '周总结' },
                { key: 'adjustment', label: '调日程' },
                { key: 'nutrition', label: '饮食' },
                { key: 'fitness', label: '健身' },
                { key: 'study', label: '学习' },
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
                <p className="text-sm">选择上方模式，我会自动读取你的全部数据并给出深度分析建议。</p>
                <p className="text-xs mt-2">当前模型: DeepSeek-R1 (支持思维链可视化)</p>
              </div>
            )}
            {conversations.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {msg.role === 'assistant' && msg.reasoning && (
                    <div className="mb-2">
                      <button
                        onClick={() => {
                          const next = new Set(showReasoning);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          setShowReasoning(next);
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
                      >
                        <Brain className="w-3 h-3" />
                        {showReasoning.has(i) ? '隐藏思考过程' : '显示思考过程'}
                      </button>
                      {showReasoning.has(i) && (
                        <div className="bg-background/50 rounded p-2 text-xs text-muted-foreground mb-2 border border-border/50 whitespace-pre-wrap">
                          {msg.reasoning}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                  <span className="animate-pulse">{reasoning ? '深度思考中...' : '连接中...'}</span>
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
