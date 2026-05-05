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
  category: 'study' | 'fitness' | 'nutrition' | 'other';
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
  duration: number;
  notes: string;
}

export interface ExerciseLog {
  name: string;
  sets: { reps: number; weight: number }[];
}

export interface AIConversation {
  id?: number;
  date: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'daily_summary' | 'weekly_summary' | 'adjustment' | 'chat';
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  gym: string;
  tasks: string[];
  modules: string[];
}

export interface FoodItem {
  name: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: 'protein' | 'carb' | 'veg' | 'fat' | 'other';
}

export interface WorkoutPreset {
  type: 'push' | 'pull' | 'legs' | 'rest' | 'cardio';
  name: string;
  exercises: { name: string; sets: number; reps: string; rest: number }[];
}
