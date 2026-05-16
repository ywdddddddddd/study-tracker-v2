// ============ AI Analysis Types ============

/** 每个分析阶段的状态 */
export interface AnalysisStage {
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: object;
  error?: string;
  timestamp: string;
}

/** AI 分析最终输出（JSON Schema） */
export interface AIFinalOutput {
  version: '1.0';
  timestamp: string;
  score: number;
  diagnosis: {
    nutrition: NutritionDiagnosis;
    fitness: FitnessDiagnosis;
    study: StudyDiagnosis;
  };
  schedule: {
    dailyTasks: ScheduledTask[];
    fitnessTasks: FitnessSuggestion[];
    weeklyPlan?: WeeklyPlan;
  };
  warnings: string[];
}

export interface NutritionDiagnosis {
  calorieStatus: string;
  proteinAdequacy: string;
  issues: string[];
  suggestions: string[];
}

export interface FitnessDiagnosis {
  progressStatus: string;
  volumeAnalysis: string;
  suggestions: string[];
}

export interface StudyDiagnosis {
  efficiencyScore: number;
  bottlenecks: string[];
  categoryBreakdown: Record<string, { used: number; budget: number }>;
  suggestions: string[];
}

export interface ScheduledTask {
  name: string;
  category: 'english' | 'dental' | 'other';
  plannedMinutes: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface FitnessSuggestion {
  name: string;
  type: 'push' | 'pull' | 'legs' | 'rest' | 'cardio';
  calories: number;
  reason: string;
}

export interface WeeklyPlan {
  focusAreas: string[];
  weeklyGoals: string;
}

// ============ LLM Provider Types ============

export type ProviderType = 'deepseek' | 'siliconflow' | 'openai' | 'anthropic' | 'google' | 'custom';

export interface LLMProvider {
  id: string;
  name: string;
  provider: ProviderType;
  apiUrl: string;
  apiKey: string;
  model: string;
  defaultParams: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  enabled: boolean;
}

/** Agent 名称 */
export type AgentName = 'nutrition' | 'fitness' | 'study' | 'scheduler' | 'validator' | 'formatter';

/** Agent 到 Provider 的映射 */
export type AgentProviderMap = Record<AgentName, string>; // agent name → provider id

// ============ Agent Definition ============

export interface AgentConfig {
  name: AgentName;
  label: string;
  systemPrompt: string;
  providerId: string;
  extraParams?: Record<string, unknown>;
}

// ============ Validation Result ============

export interface ValidationResult {
  score: number;       // 0-100
  passed: boolean;     // score > 80
  issues: string[];
  warnings: string[];
}

// ============ Default Providers ============

export const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: 'deepseek-v4',
    name: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    apiKey: import.meta.env.VITE_DEEPSEEK_KEY || '',
    model: 'deepseek-v4-pro',
    defaultParams: { temperature: 0.7, maxTokens: 4096, topP: 0.9 },
    enabled: true,
  },
  {
    id: 'siliconflow-r1',
    name: 'SiliconFlow DeepSeek-R1',
    provider: 'siliconflow',
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: import.meta.env.VITE_SILICONFLOW_KEY || '',
    model: 'deepseek-ai/DeepSeek-R1',
    defaultParams: { temperature: 0.7, maxTokens: 4096, topP: 0.9 },
    enabled: true,
  },
];

export const DEFAULT_AGENT_MAP: AgentProviderMap = {
  nutrition: 'deepseek-v4',
  fitness: 'deepseek-v4',
  study: 'deepseek-v4',
  scheduler: 'deepseek-v4',
  validator: 'deepseek-v4',
  formatter: 'siliconflow-r1',
};
