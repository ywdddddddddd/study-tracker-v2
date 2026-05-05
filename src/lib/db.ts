import Dexie, { type Table } from 'dexie';
import type {
  Profile, WeightRecord, DailyPlan, WeeklyReview,
  FoodEntry, WorkoutLog, AIConversation, Task
} from '../types';
export type { Profile, WeightRecord, DailyPlan, WeeklyReview, FoodEntry, WorkoutLog, AIConversation, Task };

export class AppDatabase extends Dexie {
  profile!: Table<Profile>;
  weightRecords!: Table<WeightRecord>;
  dailyPlans!: Table<DailyPlan>;
  weeklyReviews!: Table<WeeklyReview>;
  foodEntries!: Table<FoodEntry>;
  workoutLogs!: Table<WorkoutLog>;
  aiConversations!: Table<AIConversation>;

  constructor() {
    super('StudyTrackerDB');
    this.version(1).stores({
      profile: '++id',
      weightRecords: '++id, date',
      dailyPlans: '++id, date',
      weeklyReviews: '++id, weekStart',
      foodEntries: '++id, date',
      workoutLogs: '++id, date',
      aiConversations: '++id, date',
    });
  }
}

export const db = new AppDatabase();

export async function getOrCreateProfile(): Promise<Profile> {
  const profiles = await db.profile.toArray();
  if (profiles.length > 0) return profiles[0];
  const defaultProfile: Profile = {
    id: 1,
    height: 183,
    weight: 84,
    age: 23,
    gender: 'male',
    targetWeight: 70,
    targetBodyFat: 8,
    targetDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  };
  await db.profile.add(defaultProfile);
  return defaultProfile;
}

export async function updateProfile(profile: Profile) {
  await db.profile.put(profile);
}

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
  // 1个月减3-5kg => 每日赤字约770-1283kcal，取1000
  return Math.max(1500, tdee - 1000);
}

export function calculateMacros(profile: Profile) {
  const calories = calculateTargetCalories(profile);
  const protein = Math.round(profile.targetWeight * 2.2); // 2.2g/kg
  const fat = Math.round(profile.targetWeight * 0.9); // 0.9g/kg
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbsKcal = calories - proteinKcal - fatKcal;
  const carbs = Math.round(carbsKcal / 4);
  return { calories, protein, fat, carbs, proteinKcal, fatKcal, carbsKcal };
}
