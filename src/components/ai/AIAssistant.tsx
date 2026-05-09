import { useState, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { getOrCreateProfile, calculateMacros, type Task, type FoodEntry, getDailyPlan, getDailyPlansInRange, getFoodEntries, getWorkoutLog, getWeightRecords, getSleepRecords, getFoodEntriesInRange, getWorkoutLogsInRange, getWeeklyReview, getGymSchedules, getExtraTrainings, getExtraTrainingsInRange } from '../../lib/db';
import type { WorkoutLog } from '../../types';
import { GYM_SCHEDULE } from '../../data/presets';
import { runFullAnalysis } from '../../lib/ai/orchestrator';
import type { AIFinalOutput, AnalysisStage } from '../../lib/ai/types';
import { AnalysisDashboard } from './AnalysisDashboard';
import dayjs from 'dayjs';
import { Calendar, Bot, PlayCircle, Loader2 } from 'lucide-react';

export default function AIAssistant() {
  const [conversations, setConversations] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [stages, setStages] = useState<AnalysisStage[]>([]);
  const [finalResult, setFinalResult] = useState<AIFinalOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStart, setDataStart] = useState('2026-05-05');
  const [dataEnd, setDataEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const abortRef = useRef<AbortController | null>(null);

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
    const cd = w.exercises.filter(function (e) { return e.kind === 'cardio'; }).reduce(function (s, e) { return s + (e.cardioParams?.duration || 0); }, 0);
    const sd = Math.max(0, (w.duration || 0) - cd);
    return Math.round(cardioTotal + (sd > 0 ? 4.5 * weightKg * (sd / 60) : 0));
  }

  async function gatherContext(): Promise<string> {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

    const [profile, todayPlan, rangePlans, foodEntries, workoutLogs,
      yesterdayFoods, twoDaysAgoFoods, rangeFoodEntries, rangeWorkouts, weightRecords, sleepRecords, weekReview, gymOverrides, todayExtras, rangeExtras] = await Promise.all([
      getOrCreateProfile(), getDailyPlan(today),
      getDailyPlansInRange(dataStart, dataEnd), getFoodEntries(today), getWorkoutLog(today),
      getFoodEntries(yesterday), getFoodEntries(twoDaysAgo),
      getFoodEntriesInRange(dataStart, dataEnd), getWorkoutLogsInRange(dataStart, dataEnd),
      getWeightRecords('desc').then(function (a) { return a.slice(0, 14); }), getSleepRecords(14).then(function (a) { return a.reverse(); }),
      getWeeklyReview((() => { const d = dayjs(); const day = d.day(); return d.subtract(day === 0 ? 6 : day - 1, 'day').format('YYYY-MM-DD'); })()),
      getGymSchedules().catch(function () { return []; }),
      getExtraTrainings(today),
      getExtraTrainingsInRange(dataStart, dataEnd).catch(function () { return []; }),
    ]);

    const macros = calculateMacros(profile);
    const bmr = (profile.gender === 'male'
      ? Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5)
      : Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161));

    const foodTotal = function (entries: FoodEntry[]) { return entries.reduce(function (a, e) { return { c: a.c + e.calories, p: a.p + e.protein, f: a.f + e.fat, cb: a.cb + e.carbs }; }, { c: 0, p: 0, f: 0, cb: 0 }); };
    const ft = foodTotal(foodEntries);
    const workoutBurn = workoutLogs ? calcWorkoutBurn(workoutLogs, profile.weight) : 0;
    const todayExtraKcal = todayExtras.reduce(function (s: number, e: any) { return s + e.calories; }, 0);

    const rangeFT = foodTotal(rangeFoodEntries);
    const rangeWB = rangeWorkouts.reduce(function (s: number, w: WorkoutLog) { return s + calcWorkoutBurn(w, profile.weight); }, 0);
    const rangeExtraKcal = rangeExtras.reduce(function (s: number, e: any) { return s + e.calories; }, 0);

    const overrideMap: Record<string, string> = {};
    for (const o of gymOverrides) overrideMap[o.date] = o.gym;
    const gymScheduleText = GYM_SCHEDULE.slice(0, 7).map(function (s) {
      const gym = overrideMap[s.date] || s.gym;
      return '- ' + s.date + ' ' + s.weekday + ': ' + gym;
    }).join('\n');

    const mealLabels: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' };
    const formatFoods = function (entries: FoodEntry[], label: string) {
      if (entries.length === 0) return label + ': 无记录';
      const byMeal: Record<string, FoodEntry[]> = {};
      for (const f of entries) { if (!byMeal[f.meal]) byMeal[f.meal] = []; byMeal[f.meal].push(f); }
      return Object.entries(byMeal).map(function ([m, items]) {
        const t = items.reduce(function (s, e) { return s + e.calories; }, 0);
        return (mealLabels[m] || m) + ' (' + t + 'kcal):\n' + items.map(function (e) { return '  - ' + e.name + ' ' + e.weight + 'g (' + e.calories + 'kcal, P' + e.protein + 'g C' + e.carbs + 'g F' + e.fat + 'g)'; }).join('\n');
      }).join('\n') || label + ': 无记录';
    };

    const catBudget: Record<string, number> = { dental: (weekReview?.budgetDental || 10.5) * 60, english: (weekReview?.budgetEnglish || 7) * 60, other: (weekReview?.budgetReview || 2) * 60 };
    const catUsed: Record<string, number> = { dental: 0, english: 0, other: 0 };
    for (const p of rangePlans) for (const t of p.tasks) if (t.status === 'completed') catUsed[t.category] = (catUsed[t.category] || 0) + (t.actualMinutes || 0);
    const daysRemaining = Math.max(1, 7 - rangePlans.length);
    const budgetLines = ['dental', 'english', 'other'].map(function (cat) {
      const u = Math.round(catUsed[cat] || 0), t = catBudget[cat] || 0, r = Math.max(0, t - u);
      return '- ' + (cat === 'dental' ? '专业课' : cat === 'english' ? '英语' : '其它') + ': 已用' + u + 'min/' + t + 'min, 剩余' + r + 'min, 建议每日' + Math.round(r / daysRemaining) + 'min';
    }).join('\n');

    const weightTrend = weightRecords.length >= 2 ? weightRecords[weightRecords.length - 1].weight - weightRecords[0].weight : 0;

    return '=== 用户档案 ===\n' +
      '性别：' + (profile.gender === 'male' ? '男' : '女') + '，年龄' + profile.age + '岁，身高' + profile.height + 'cm，当前体重' + profile.weight + 'kg\n' +
      '目标体重：' + profile.targetWeight + 'kg，目标体脂：' + profile.targetBodyFat + '%\n' +
      'BMR：' + bmr + ' kcal/天，目标热量：' + macros.calories + 'kcal，P' + macros.protein + 'g C' + macros.carbs + 'g F' + macros.fat + 'g\n\n' +
      '=== 健身日程表（近7天）===\n' + gymScheduleText + '\n\n' +
      '=== 今日学习 ===\n' + (todayPlan ? todayPlan.tasks.map(function (t: Task) {
        const eff = t.completionRate !== undefined ? t.completionRate + '%' : (t.status === 'completed' ? '100%' : 'N/A');
        return '- ' + t.text + ': ' + (t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⬜') + ' 效率' + eff + ' 实际' + t.actualMinutes + 'min/预计' + t.plannedMinutes + 'min' + (t.reason ? ' [' + t.reason + ']' : '');
      }).join('\n') : '无记录') + '\n' +
      '总专注：' + (todayPlan?.totalFocusMinutes || 0) + 'min | 复盘：' + (todayPlan?.conquered || '无') + ' | 难点：' + (todayPlan?.difficulty || '无') + '\n' +
      '今日运动消耗：' + workoutBurn + 'kcal | 加练：' + todayExtraKcal + 'kcal | 总消耗：' + (workoutBurn + todayExtraKcal + bmr) + 'kcal\n\n' +
      '=== 今日饮食 ===\n' + formatFoods(foodEntries, '今日') + '\n' +
      '今日总计：' + ft.c + 'kcal P' + ft.p.toFixed(1) + ' C' + ft.cb.toFixed(1) + ' F' + ft.f.toFixed(1) + '\n' +
      '目标：' + macros.calories + 'kcal P' + macros.protein + 'g C' + macros.carbs + 'g F' + macros.fat + 'g\n\n' +
      '=== 昨日饮食 ===\n' + formatFoods(yesterdayFoods, '昨日') + '\n\n' +
      '=== 前日饮食 ===\n' + formatFoods(twoDaysAgoFoods, '前日') + '\n\n' +
      '=== 今日训练 ===\n' + (workoutLogs ? '类型：' + workoutLogs.type + '，时长' + workoutLogs.duration + 'min，运动消耗' + workoutBurn + 'kcal，总消耗' + (workoutBurn + bmr) + 'kcal\n' +
      '动作：\n' + workoutLogs.exercises.map(function (ex) { return ex.kind === 'cardio' ? '  - ' + ex.name + ': 有氧 ' + (ex.cardioParams?.duration || 0) + 'min @' + (ex.cardioParams?.speed || 0) + 'km/h' : '  - ' + ex.name + ': 力量 ' + ex.sets.length + '组 (' + ex.sets.map(function (s) { return s.reps + '次' + (s.weight > 0 ? s.weight + 'kg' : ''); }).join(', ') + ')'; }).join('\n') : '无训练记录') + '\n' +
      '加练：' + (todayExtras.length > 0 ? todayExtras.map(function (e: any) { return '  - ' + e.name + ' (' + e.type + ') ' + e.calories + 'kcal'; }).join('\n') : '无') + '\n' +
      '=== 范围统计(' + dataStart + '~' + dataEnd + ') ===\n' +
      '记录：' + rangePlans.length + '天 | 完成任务：' + rangePlans.reduce(function (s, p) { return s + p.tasks.filter(function (t) { return t.status === 'completed'; }).length; }, 0) + ' | 失败：' + rangePlans.reduce(function (s, p) { return s + p.tasks.filter(function (t) { return t.status === 'failed'; }).length; }, 0) + '\n' +
      '总专注：' + rangePlans.reduce(function (s, p) { return s + p.totalFocusMinutes; }, 0) + 'min\n' +
      '总摄入：' + rangeFT.c + 'kcal P' + rangeFT.p.toFixed(1) + ' C' + rangeFT.cb.toFixed(1) + ' F' + rangeFT.f.toFixed(1) + '\n' +
      '总训练消耗：' + rangeWB + 'kcal | 加练：' + rangeExtraKcal + 'kcal | 总消耗：' + (rangeWB + rangeExtraKcal) + 'kcal\n' +
      '预估赤字：' + (rangeWB + rangeExtraKcal + bmr * rangePlans.length - rangeFT.c) + 'kcal\n\n' +
      '=== 本周预算 ===\n' + budgetLines + '\n' +
      '目标：' + (weekReview?.taskGoals || '无') + ' | 进度：' + (weekReview?.progressGoals || '无') + '\n' +
      '运动配额：' + (weekReview?.budgetSport || 3.5) + 'h/周\n\n' +
      '=== 体重（14天）===\n' + weightRecords.map(function (w) { return '- ' + w.date + ': ' + w.weight + 'kg' + (w.bodyFat ? ' (体脂' + w.bodyFat + '%)' : ''); }).join('\n') + '\n' +
      '趋势：' + (weightTrend > 0 ? '↑' : weightTrend < 0 ? '↓' : '→') + ' ' + Math.abs(weightTrend).toFixed(1) + 'kg\n\n' +
      '=== 睡眠（14天）===\n' + sleepRecords.map(function (s) { return '- ' + s.date + ': ' + s.bedTime + '→' + s.wakeTime + ' ' + Math.floor(s.duration / 60) + 'h' + s.duration % 60 + 'm ★' + s.quality; }).join('\n') + '\n';
  }

  const handleAnalyze = useCallback(async function () {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    setFinalResult(null);
    setStages([]);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const label = '全链条分析 (' + dataStart + ' ~ ' + dataEnd + ')';
    setConversations(function (prev) { return [...prev, { role: 'user', content: label }]; });

    try {
      const ctx = await gatherContext();
      await runFullAnalysis(ctx, {
        signal: abortRef.current.signal,
        onStageChange: function (updatedStages) {
          setStages(updatedStages);
        },
        onComplete: function (result) {
          setFinalResult(result);
          setIsAnalyzing(false);
          setConversations(function (prev) {
            return [...prev, { role: 'assistant', content: '分析完成 | 评分: ' + result.score + ' | 学习任务 ' + result.schedule.dailyTasks.length + ' 项 | 健身建议 ' + result.schedule.fitnessTasks.length + ' 项' }];
          });
        },
        onError: function (err, stage) {
          setError(stage + ' 阶段失败: ' + err.message);
          setIsAnalyzing(false);
        },
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError('分析失败: ' + (e.message || '未知错误'));
        setIsAnalyzing(false);
      }
    }
  }, [isAnalyzing, dataStart, dataEnd]);

  const handleAbort = useCallback(function () {
    abortRef.current?.abort();
    setIsAnalyzing(false);
  }, []);

  const handleRetry = useCallback(function () {
    setFinalResult(null);
    setStages([]);
    setError(null);
    handleAnalyze();
  }, [handleAnalyze]);

  return (
    <div className="space-y-4 animate-in">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            <Bot className="w-5 h-5" />
            <span>AI分析引擎</span>
            <span className="text-xs text-muted-foreground ml-auto">
              DeepSeek V4 Pro + 多Agent链式编排
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <Input type="date" value={dataStart} onChange={function (e) { setDataStart(e.target.value); }} className="w-auto h-7 text-xs px-2" />
            <span className="text-xs text-muted-foreground">至</span>
            <Input type="date" value={dataEnd} onChange={function (e) { setDataEnd(e.target.value); }} className="w-auto h-7 text-xs px-2" />
            {!isAnalyzing && !finalResult && (
              <Button onClick={handleAnalyze} className="ml-auto" size="sm">
                <PlayCircle className="w-4 h-4 mr-1" />
                全链条分析
              </Button>
            )}
            {isAnalyzing && (
              <Button onClick={handleAbort} variant="outline" size="sm" className="ml-auto">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                停止
              </Button>
            )}
            {finalResult && !isAnalyzing && (
              <Button onClick={handleRetry} variant="outline" size="sm" className="ml-auto">
                重新分析
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {(stages.length > 0 || finalResult || isAnalyzing) && (
        <AnalysisDashboard
          stages={stages}
          finalResult={finalResult}
          isLoading={isAnalyzing}
          conversations={conversations}
          onRetry={!isAnalyzing && stages.length > 0 ? handleRetry : undefined}
        />
      )}

      {!isAnalyzing && stages.length === 0 && !finalResult && (
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg mb-2">👋 AI 分析引擎</p>
          <p className="text-sm mb-3">点击「全链条分析」启动多 Agent 协同分析</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>分析流程: 饮食 → 健身 → 学习 → 综合安排 → 校验评分</p>
            <p>完成后可一键安排学习任务和加练到明日计划</p>
          </div>
        </div>
      )}
    </div>
  );
}
