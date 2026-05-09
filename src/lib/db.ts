import { supabase } from './supabase';
import { cachedFetch, cachedFetchList, cacheWrite, cacheDel } from './cache';
import type {
  Profile, WeightRecord, DailyPlan, WeeklyReview,
  FoodEntry, WorkoutLog, AIConversation, Task, SleepRecord, ExtraTraining
} from '../types';
export type { Profile, WeightRecord, DailyPlan, WeeklyReview, FoodEntry, WorkoutLog, AIConversation, Task, SleepRecord, ExtraTraining };

// --- Profile ---
export async function getOrCreateProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').limit(1).single();
  if (data && !error) {
    return {
      id: data.id,
      height: data.height,
      weight: data.weight,
      age: data.age,
      gender: data.gender,
      targetWeight: data.target_weight,
      targetBodyFat: data.target_body_fat,
      targetDate: data.target_date,
    };
  }
  const defaultProfile = {
    height: 183,
    weight: 84,
    age: 23,
    gender: 'male',
    target_weight: 70,
    target_body_fat: 8,
    target_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  };
  const { data: inserted, error: insertErr } = await supabase.from('profiles').insert(defaultProfile).select().single();
  if (insertErr || !inserted) throw insertErr || new Error('Failed to create profile');
  return {
    id: inserted.id,
    height: inserted.height,
    weight: inserted.weight,
    age: inserted.age,
    gender: inserted.gender,
    targetWeight: inserted.target_weight,
    targetBodyFat: inserted.target_body_fat,
    targetDate: inserted.target_date,
  };
}

export async function updateProfile(profile: Profile) {
  await supabase.from('profiles').upsert({
    id: profile.id,
    height: profile.height,
    weight: profile.weight,
    age: profile.age,
    gender: profile.gender,
    target_weight: profile.targetWeight,
    target_body_fat: profile.targetBodyFat,
    target_date: profile.targetDate,
  });
}

// --- Weight Records ---
export async function getWeightRecords(order: 'asc' | 'desc' = 'asc'): Promise<WeightRecord[]> {
  return cachedFetchList('weight_records', 'list_' + order, async () => {
    const { data, error } = await supabase.from('weight_records').select('*').order('date', { ascending: order === 'asc' });
    if (error) throw error;
    return (data || []).map((d: any) => ({ id: d.id, date: d.date, weight: d.weight, bodyFat: d.body_fat, note: d.note }));
  });
}

export async function addWeightRecord(record: Omit<WeightRecord, 'id'>) {
  const { error } = await supabase.from('weight_records').insert({ date: record.date, weight: record.weight, body_fat: record.bodyFat, note: record.note });
  if (error) throw error;
  await cacheDel('weight_records', 'list_asc');
  await cacheDel('weight_records', 'list_desc');
}

export async function deleteWeightRecord(id: number) {
  await supabase.from('weight_records').delete().eq('id', id);
  await cacheDel('weight_records', 'list_asc');
  await cacheDel('weight_records', 'list_desc');
}

// --- Daily Plans ---
export async function getDailyPlan(date: string): Promise<DailyPlan | null> {
  return cachedFetch('daily_plans', date, async () => {
    const { data, error } = await supabase.from('daily_plans').select('*').eq('date', date).single();
    if (error || !data) return null;
    return {
      id: data.id, date: data.date, tasks: data.tasks as Task[],
      conquered: data.conquered, difficulty: data.difficulty,
      adjust: data.adjust, completion: data.completion,
      totalFocusMinutes: data.total_focus_minutes,
    };
  });
}

export async function getDailyPlansInRange(start: string, end: string): Promise<DailyPlan[]> {
  const { data, error } = await supabase.from('daily_plans').select('*').gte('date', start).lte('date', end).order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, tasks: d.tasks as Task[],
    conquered: d.conquered, difficulty: d.difficulty,
    adjust: d.adjust, completion: d.completion,
    totalFocusMinutes: d.total_focus_minutes,
  }));
}

export async function getAllDailyPlans(): Promise<DailyPlan[]> {
  const { data, error } = await supabase.from('daily_plans').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, tasks: d.tasks as Task[],
    conquered: d.conquered, difficulty: d.difficulty,
    adjust: d.adjust, completion: d.completion,
    totalFocusMinutes: d.total_focus_minutes,
  }));
}

export async function saveDailyPlan(plan: DailyPlan) {
  const { error } = await supabase.from('daily_plans').upsert({
    date: plan.date,
    tasks: plan.tasks,
    conquered: plan.conquered,
    difficulty: plan.difficulty,
    adjust: plan.adjust,
    completion: plan.completion,
    total_focus_minutes: plan.totalFocusMinutes,
  }, { onConflict: 'date' });
  if (error) throw error;
  await cacheWrite('daily_plans', plan.date, plan);
}

// --- Weekly Reviews ---
export async function getWeeklyReview(weekStart: string): Promise<WeeklyReview | null> {
  return cachedFetch('weekly_reviews', weekStart, async () => {
    const { data, error } = await supabase.from('weekly_reviews').select('*').eq('week_start', weekStart).single();
    if (error || !data) return null;
    return {
      id: data.id, weekStart: data.week_start, timeHole: data.time_hole,
      focusHours: data.focus_hours, budgetDental: data.budget_dental,
      budgetEnglish: data.budget_english, budgetReview: data.budget_review,
      budgetSport: data.budget_sport, goals: data.goals, adjust: data.adjust,
      taskGoals: data.task_goals || '', progressGoals: data.progress_goals || '',
    };
  });
}

export async function getWeeklyReviews(): Promise<WeeklyReview[]> {
  const { data, error } = await supabase.from('weekly_reviews').select('*').order('week_start', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, weekStart: d.week_start, timeHole: d.time_hole,
    focusHours: d.focus_hours, budgetDental: d.budget_dental,
    budgetEnglish: d.budget_english, budgetReview: d.budget_review,
    budgetSport: d.budget_sport, goals: d.goals, adjust: d.adjust,
    taskGoals: d.task_goals || '', progressGoals: d.progress_goals || '',
  }));
}

export async function saveWeeklyReview(review: WeeklyReview) {
  await supabase.from('weekly_reviews').upsert({
    id: review.id,
    week_start: review.weekStart,
    time_hole: review.timeHole,
    focus_hours: review.focusHours,
    budget_dental: review.budgetDental,
    budget_english: review.budgetEnglish,
    budget_review: review.budgetReview,
    budget_sport: review.budgetSport,
    goals: review.goals,
    adjust: review.adjust,
    task_goals: review.taskGoals,
    progress_goals: review.progressGoals,
  });
  await cacheWrite('weekly_reviews', review.weekStart, review);
}

// --- Food Entries ---
export async function getFoodEntries(date: string): Promise<FoodEntry[]> {
  return cachedFetchList('food_entries', date, async () => {
    const { data, error } = await supabase.from('food_entries').select('*').eq('date', date).order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id, date: d.date, meal: d.meal, name: d.name,
      weight: d.weight, calories: d.calories, protein: d.protein,
      carbs: d.carbs, fat: d.fat, isCustom: d.is_custom,
    }));
  });
}

export async function getFoodEntriesInRange(start: string, end: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase.from('food_entries').select('*').gte('date', start).lte('date', end);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, meal: d.meal, name: d.name,
    weight: d.weight, calories: d.calories, protein: d.protein,
    carbs: d.carbs, fat: d.fat, isCustom: d.is_custom,
  }));
}

export async function addFoodEntry(entry: Omit<FoodEntry, 'id'>) {
  const { error } = await supabase.from('food_entries').insert({
    date: entry.date, meal: entry.meal, name: entry.name,
    weight: entry.weight, calories: entry.calories, protein: entry.protein,
    carbs: entry.carbs, fat: entry.fat, is_custom: entry.isCustom,
  });
  if (error) throw error;
  await cacheDel('food_entries', entry.date);
}

export async function deleteFoodEntry(id: number) {
  // Get the entry date first for cache invalidation
  const { data } = await supabase.from('food_entries').select('date').eq('id', id).single();
  await supabase.from('food_entries').delete().eq('id', id);
  if (data?.date) await cacheDel('food_entries', data.date);
}

export async function bulkPutFoodEntries(entries: FoodEntry[]) {
  if (entries.length === 0) return;
  const rows = entries.map(e => ({
    id: e.id,
    date: e.date, meal: e.meal, name: e.name,
    weight: e.weight, calories: e.calories, protein: e.protein,
    carbs: e.carbs, fat: e.fat, is_custom: e.isCustom,
  }));
  const { error } = await supabase.from('food_entries').upsert(rows);
  if (error) throw error;
}

// --- Workout Logs ---
export async function getWorkoutLog(date: string): Promise<WorkoutLog | null> {
  return cachedFetch('workout_logs', date, async () => {
    const { data, error } = await supabase.from('workout_logs').select('*').eq('date', date).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id, date: data.date, type: data.type,
      exercises: data.exercises, duration: data.duration, notes: data.notes,
    } as WorkoutLog;
  });
}

export async function getWorkoutLogsInRange(start: string, end: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase.from('workout_logs').select('*').gte('date', start).lte('date', end);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, type: d.type,
    exercises: d.exercises, duration: d.duration, notes: d.notes,
  } as WorkoutLog));
}

export async function saveWorkoutLog(log: WorkoutLog) {
  const { error } = await supabase.from('workout_logs').upsert({
    date: log.date, type: log.type, exercises: log.exercises,
    duration: log.duration, notes: log.notes,
  }, { onConflict: 'date' });
  if (error) throw error;
  await cacheWrite('workout_logs', log.date, log);
}

// --- Sleep Records ---
export async function getSleepRecords(limit?: number): Promise<SleepRecord[]> {
  const key = 'list_' + (limit || 'all');
  return cachedFetchList('sleep_records', key, async () => {
    let q = supabase.from('sleep_records').select('*').order('date', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id, date: d.date, bedTime: d.bed_time, wakeTime: d.wake_time,
      duration: d.duration, quality: d.quality, note: d.note,
    })).reverse();
  });
}

export async function addSleepRecord(record: Omit<SleepRecord, 'id'>) {
  const { error } = await supabase.from('sleep_records').insert({
    date: record.date, bed_time: record.bedTime, wake_time: record.wakeTime,
    duration: record.duration, quality: record.quality, note: record.note,
  });
  if (error) throw error;
  await cacheDel('sleep_records', 'list_all');
  await cacheDel('sleep_records', 'list_14');
}

export async function deleteSleepRecord(id: number) {
  await supabase.from('sleep_records').delete().eq('id', id);
}

export async function updateSleepRecord(record: SleepRecord) {
  const { error } = await supabase.from('sleep_records').update({
    date: record.date, bed_time: record.bedTime, wake_time: record.wakeTime,
    duration: record.duration, quality: record.quality, note: record.note,
  }).eq('id', record.id);
  if (error) throw error;
}

export async function bulkPutSleepRecords(records: SleepRecord[]) {
  if (records.length === 0) return;
  const rows = records.map(r => ({
    id: r.id, date: r.date, bed_time: r.bedTime, wake_time: r.wakeTime,
    duration: r.duration, quality: r.quality, note: r.note,
  }));
  const { error } = await supabase.from('sleep_records').upsert(rows);
  if (error) throw error;
}

// --- AI Conversations ---
export async function getAIConversations(): Promise<AIConversation[]> {
  const { data, error } = await supabase.from('ai_conversations').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, role: d.role, content: d.content, type: d.type,
  }));
}

export async function saveAIConversation(conv: AIConversation) {
  await supabase.from('ai_conversations').insert({
    date: conv.date, role: conv.role, content: conv.content, type: conv.type,
  });
}

// --- Custom Foods (用户可编辑的食物库) ---
export async function getCustomFoods(): Promise<{ name: string; unit: string; gramsPerUnit: number; calories: number; protein: number; carbs: number; fat: number; category: string }[]> {
  const { data, error } = await supabase.from('custom_foods').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    name: d.name, unit: d.unit, gramsPerUnit: d.grams_per_unit,
    calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat, category: d.category,
  }));
}

export async function saveCustomFood(food: { name: string; unit: string; gramsPerUnit: number; calories: number; protein: number; carbs: number; fat: number; category: string }) {
  const { error } = await supabase.from('custom_foods').upsert({
    name: food.name, unit: food.unit, grams_per_unit: food.gramsPerUnit,
    calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, category: food.category,
  });
  if (error) throw error;
}

export async function deleteCustomFood(name: string) {
  await supabase.from('custom_foods').delete().eq('name', name);
}

// --- Custom Schedules (用户可编辑的学习计划) ---
export async function getCustomSchedules(): Promise<{ date: string; weekday: string; gym: string; tasks: { text: string; category: 'english' | 'dental' | 'other' }[] }[]> {
  const { data, error } = await supabase.from('custom_schedules').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    date: d.date, weekday: d.weekday, gym: d.gym, tasks: d.tasks,
  }));
}

export async function getCustomSchedule(date: string): Promise<{ date: string; weekday: string; gym: string; tasks: { text: string; category: 'english' | 'dental' | 'other' }[] } | null> {
  const { data, error } = await supabase.from('custom_schedules').select('*').eq('date', date).single();
  if (error || !data) return null;
  return { date: data.date, weekday: data.weekday, gym: data.gym, tasks: data.tasks };
}

export async function saveCustomSchedule(schedule: { date: string; weekday: string; gym: string; tasks: { text: string; category: 'english' | 'dental' | 'other' }[] }) {
  const { error } = await supabase.from('custom_schedules').upsert({
    date: schedule.date, weekday: schedule.weekday, gym: schedule.gym, tasks: schedule.tasks,
  }, { onConflict: 'date' });
  if (error) throw error;
}

export async function deleteCustomSchedule(date: string) {
  await supabase.from('custom_schedules').delete().eq('date', date);
}

// --- Gym Schedules (健身日程自定义) ---
export async function getGymSchedules(): Promise<{ date: string; gym: string }[]> {
  const { data, error } = await supabase.from('gym_schedules').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({ date: d.date, gym: d.gym }));
}

export async function saveGymSchedule(date: string, gym: string) {
  const { error } = await supabase.from('gym_schedules').upsert({ date, gym }, { onConflict: 'date' });
  if (error) throw error;
}

// --- Task Templates (任务模板) ---
export async function getTaskTemplates(): Promise<{ id: string; text: string; category: 'english' | 'dental' | 'other'; plannedMinutes: number }[]> {
  const { data, error } = await supabase.from('task_templates').select('*').order('id', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({ id: d.id, text: d.text, category: d.category as any, plannedMinutes: d.planned_minutes }));
}

export async function saveTaskTemplate(template: { id: string; text: string; category: string; plannedMinutes: number }) {
  const { error } = await supabase.from('task_templates').upsert({
    id: template.id,
    text: template.text,
    category: template.category,
    planned_minutes: template.plannedMinutes,
  });
  if (error) throw error;
}

export async function deleteTaskTemplate(id: string) {
  await supabase.from('task_templates').delete().eq('id', id);
}

// --- Extra Trainings (加练) ---
export async function getExtraTrainings(date: string): Promise<ExtraTraining[]> {
  return cachedFetchList('extra_trainings', date, async () => {
    const { data, error } = await supabase.from('extra_trainings').select('*').eq('date', date).order('id', { ascending: true });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id, date: d.date, name: d.name,
      type: d.type, calories: d.calories, notes: d.notes || '',
    }));
  });
}

export async function getExtraTrainingsInRange(start: string, end: string): Promise<ExtraTraining[]> {
  const { data, error } = await supabase.from('extra_trainings').select('*').gte('date', start).lte('date', end);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id, date: d.date, name: d.name,
    type: d.type, calories: d.calories, notes: d.notes || '',
  }));
}

export async function saveExtraTraining(training: Omit<ExtraTraining, 'id'>) {
  const { error } = await supabase.from('extra_trainings').insert({
    date: training.date, name: training.name,
    type: training.type, calories: training.calories, notes: training.notes || '',
  });
  if (error) throw error;
  await cacheDel('extra_trainings', training.date);
}

export async function deleteExtraTraining(id: number) {
  const { data } = await supabase.from('extra_trainings').select('date').eq('id', id).single();
  await supabase.from('extra_trainings').delete().eq('id', id);
  if (data?.date) await cacheDel('extra_trainings', data.date);
}

// --- Export / Import ---
export async function exportAllData() {
  const [profile, weightRecords, dailyPlans, weeklyReviews, foodEntries, workoutLogs, aiConversations, sleepRecords, customFoods, customSchedules] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('weight_records').select('*'),
    supabase.from('daily_plans').select('*'),
    supabase.from('weekly_reviews').select('*'),
    supabase.from('food_entries').select('*'),
    supabase.from('workout_logs').select('*'),
    supabase.from('ai_conversations').select('*'),
    supabase.from('sleep_records').select('*'),
    supabase.from('custom_foods').select('*'),
    supabase.from('custom_schedules').select('*'),
  ]);
  return {
    profile: profile.data || [],
    weightRecords: weightRecords.data || [],
    dailyPlans: dailyPlans.data || [],
    weeklyReviews: weeklyReviews.data || [],
    foodEntries: foodEntries.data || [],
    workoutLogs: workoutLogs.data || [],
    aiConversations: aiConversations.data || [],
    sleepRecords: sleepRecords.data || [],
    customFoods: customFoods.data || [],
    customSchedules: customSchedules.data || [],
    exportedAt: new Date().toISOString(),
  };
}

export async function importAllData(data: any) {
  if (data.profile?.length) await supabase.from('profiles').upsert(data.profile);
  if (data.weightRecords?.length) await supabase.from('weight_records').upsert(data.weightRecords);
  if (data.dailyPlans?.length) {
    const rows = data.dailyPlans.map((d: any) => ({
      date: d.date, tasks: d.tasks, conquered: d.conquered || '',
      difficulty: d.difficulty || '', adjust: d.adjust || '',
      completion: d.completion || '', total_focus_minutes: d.totalFocusMinutes || 0,
    }));
    await supabase.from('daily_plans').upsert(rows);
  }
  if (data.weeklyReviews?.length) {
    const rows = data.weeklyReviews.map((d: any) => ({
      week_start: d.weekStart, time_hole: d.timeHole || '',
      focus_hours: d.focusHours || 0, budget_dental: d.budgetDental || 0,
      budget_english: d.budgetEnglish || 0, budget_review: d.budgetReview || 0,
      budget_sport: d.budgetSport || 0, goals: d.goals || '', adjust: d.adjust || '',
    }));
    await supabase.from('weekly_reviews').upsert(rows);
  }
  if (data.foodEntries?.length) {
    const rows = data.foodEntries.map((e: any) => ({
      id: e.id, date: e.date, meal: e.meal, name: e.name,
      weight: e.weight, calories: e.calories, protein: e.protein,
      carbs: e.carbs, fat: e.fat, is_custom: e.isCustom,
    }));
    await supabase.from('food_entries').upsert(rows);
  }
  if (data.workoutLogs?.length) {
    const rows = data.workoutLogs.map((w: any) => ({
      date: w.date, type: w.type, exercises: w.exercises,
      duration: w.duration || 60, notes: w.notes || '',
    }));
    await supabase.from('workout_logs').upsert(rows);
  }
  if (data.aiConversations?.length) await supabase.from('ai_conversations').upsert(data.aiConversations);
  if (data.sleepRecords?.length) {
    const rows = data.sleepRecords.map((s: any) => ({
      date: s.date, bed_time: s.bedTime, wake_time: s.wakeTime,
      duration: s.duration, quality: s.quality, note: s.note,
    }));
    await supabase.from('sleep_records').upsert(rows);
  }
  if (data.customFoods?.length) await supabase.from('custom_foods').upsert(data.customFoods);
  if (data.customSchedules?.length) await supabase.from('custom_schedules').upsert(data.customSchedules);
}

export async function clearAllData() {
  const tables = ['profiles', 'weight_records', 'daily_plans', 'weekly_reviews', 'food_entries', 'workout_logs', 'ai_conversations', 'sleep_records', 'custom_foods', 'custom_schedules'];
  for (const t of tables) {
    await supabase.from(t).delete().neq('id', 0);
  }
}

// --- Utilities ---
export function calculateBMR(profile: Profile): number {
  if (profile.gender === 'male') {
    return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  }
  return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
}

export function calculateTDEE(profile: Profile, activityLevel: number = 1.55): number {
  return Math.round(calculateBMR(profile) * activityLevel);
}

export function calculateTargetCalories(profile: Profile): number {
  const tdee = calculateTDEE(profile);
  return Math.max(1500, tdee - 1000);
}

export function calculateMacros(profile: Profile) {
  const calories = calculateTargetCalories(profile);
  const protein = Math.round(profile.targetWeight * 2.2);
  const fat = Math.round(profile.targetWeight * 0.9);
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = calories - proteinKcal - fatKcal;
  const carbs = Math.round(carbsKcal / 4);
  return { calories, protein, fat, carbs, proteinKcal, fatKcal, carbsKcal };
}

// Backward-compat: keep `db` export shape so components that reference db.dailyPlans etc. can compile
// We replace with no-op warning stubs to show what needs migration
const warn = (name: string) => console.warn(`[DEPRECATED] db.${name} is removed. Use the new functions from lib/db.ts instead.`);
export const db = {
  dailyPlans: { where: () => ({ equals: () => ({ first: () => { warn('dailyPlans'); return Promise.resolve(null); } }), toArray: () => { warn('dailyPlans'); return Promise.resolve([]); } }), filter: () => ({ toArray: () => { warn('dailyPlans'); return Promise.resolve([]); } }), put: () => { warn('dailyPlans'); return Promise.resolve(); } },
  weightRecords: { orderBy: () => ({ reverse: () => ({ limit: () => ({ toArray: () => { warn('weightRecords'); return Promise.resolve([]); } }) }), toArray: () => { warn('weightRecords'); return Promise.resolve([]); } }), where: () => ({ equals: () => ({ toArray: () => { warn('weightRecords'); return Promise.resolve([]); } }) }), put: () => { warn('weightRecords'); return Promise.resolve(); } },
  foodEntries: { where: () => ({ equals: () => ({ toArray: () => { warn('foodEntries'); return Promise.resolve([]); } }) }), add: () => { warn('foodEntries'); return Promise.resolve(); }, delete: () => { warn('foodEntries'); return Promise.resolve(); }, bulkPut: () => { warn('foodEntries'); return Promise.resolve(); } },
  workoutLogs: { where: () => ({ equals: () => ({ first: () => { warn('workoutLogs'); return Promise.resolve(null); } }), toArray: () => { warn('workoutLogs'); return Promise.resolve([]); } }) } as any,
  sleepRecords: { orderBy: () => ({ reverse: () => ({ limit: () => ({ toArray: () => { warn('sleepRecords'); return Promise.resolve([]); } }) }) }), add: () => { warn('sleepRecords'); return Promise.resolve(); }, bulkPut: () => { warn('sleepRecords'); return Promise.resolve(); } },
  aiConversations: { toArray: () => { warn('aiConversations'); return Promise.resolve([]); }, add: () => { warn('aiConversations'); return Promise.resolve(); } },
  weeklyReviews: { toArray: () => { warn('weeklyReviews'); return Promise.resolve([]); } },
  profile: { toArray: () => { warn('profile'); return Promise.resolve([]); }, add: () => { warn('profile'); return Promise.resolve(); }, put: () => { warn('profile'); return Promise.resolve(); } },
  delete: () => Promise.resolve(),
};
