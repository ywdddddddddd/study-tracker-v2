export interface Profile {
  id: number;
  height: number; // cm
  weight: number; // kg
  age: number;
  gender: 'male' | 'female';
  targetWeight: number;
  targetBodyFat: number;
  targetDate: string;
}

export interface WeightRecord {
  id?: number;
  date: string;
  weight: number;
  bodyFat?: number;
  note?: string;
}

export interface Task {
  id: string;
  text: string;
  category: 'english' | 'dental' | 'other';
  status: 'pending' | 'doing' | 'completed' | 'failed';
  plannedMinutes: number;
  actualMinutes: number;
  timerStartedAt?: number;
  timerPausedAt?: number;
  timerAccumulated: number;
}

export interface DailyPlan {
  id?: number;
  date: string;
  tasks: Task[];
  conquered: string;
  difficulty: string;
  adjust: string;
  completion: string;
  totalFocusMinutes: number;
}

export interface WeeklyReview {
  id?: number;
  weekStart: string;
  timeHole: string;
  focusHours: number;
  budgetDental: number;
  budgetEnglish: number;
  budgetReview: number;
  budgetSport: number;
  goals: string;
  adjust: string;
}

export interface FoodEntry {
  id?: number;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  weight: number; // g
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isCustom: boolean;
}

export interface WorkoutLog {
  id?: number;
  date: string;
  type: 'push' | 'pull' | 'legs' | 'rest' | 'cardio';
  exercises: ExerciseLog[];
  cardio?: CardioLog;
  duration: number;
  notes: string;
}

export interface ExerciseLog {
  name: string;
  kind: 'strength' | 'cardio';
  sets: { reps: number; weight: number }[];
  cardioParams?: { speed?: number; incline?: number; duration?: number };
}

export interface CardioLog {
  type: 'treadmill' | 'elliptical' | 'bike' | 'other';
  speed?: number; // km/h
  incline?: number; // %
  duration: number; // min
  distance?: number; // km
}

export interface SleepRecord {
  id?: number;
  date: string;
  bedTime: string; // HH:mm
  wakeTime: string; // HH:mm
  duration: number; // min, auto calculated
  quality: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface AIConversation {
  id?: number;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'daily_summary' | 'weekly_summary' | 'adjustment';
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  gym: string;
  tasks: { text: string; category: 'english' | 'dental' | 'other' }[];
}

export interface FoodItem {
  name: string;
  unit: string;
  gramsPerUnit: number; // 每"单位"对应多少克 (如: 1个鸡蛋=50g, 则 gramsPerUnit=50)
  calories: number; // 每单位的热量
  protein: number;
  carbs: number;
  fat: number;
  category: 'protein' | 'carb' | 'veg' | 'fat' | 'other';
}

export interface WorkoutPreset {
  type: 'push' | 'pull' | 'legs' | 'rest' | 'cardio';
  name: string;
  exercises: { name: string; kind: 'strength' | 'cardio'; sets: number; reps: string; rest: number; cardioParams?: { speed?: number; incline?: number; duration?: number } }[];
}
