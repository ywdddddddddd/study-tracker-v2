// ============ Extra Training (加练) Types ============

export interface ExtraTraining {
  id?: number;
  date: string;
  name: string;
  type: 'push' | 'pull' | 'legs' | 'rest' | 'cardio';
  calories: number;
  notes?: string;
}
