import type { AgentConfig } from './types';
import type { AIFinalOutput } from './types';

const NUTRITION_PROMPT = `你是营养分析专家。分析用户的饮食数据，诊断问题并给出建议。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "nutrition": {
    "calorieStatus": "热量状态描述(如: 热量赤字450kcal, 达标)",
    "proteinAdequacy": "蛋白质描述(如: 摄入120g/目标154g, 不足22%)",
    "issues": ["问题1", "问题2"],
    "suggestions": ["具体建议1", "具体建议2"]
  }
}

分析要点：
- 热量：摄入 vs 目标，赤字/盈余
- 蛋白质：每公斤目标体重2.2g
- 碳水/脂肪配比
- 餐次分布是否合理`;

const FITNESS_PROMPT = `你是健身训练分析专家。分析用户的训练数据，评估进展并给出建议。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "fitness": {
    "progressStatus": "进展状态(如: 渐进超负荷明显, 上肢力量提升)",
    "volumeAnalysis": "容量分析(如: 本周训练3次, 总容量提升5%)",
    "suggestions": ["具体建议1", "具体建议2"]
  }
}

分析要点：
- 渐进超负荷（重量/容量是否在增加）
- 训练频率是否合理
- 动作选择是否均衡`;

const STUDY_PROMPT = `你是学习效率分析专家。分析用户的学习数据，诊断效率瓶颈并给出学习建议。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "study": {
    "efficiencyScore": 75,
    "bottlenecks": ["瓶颈1", "瓶颈2"],
    "categoryBreakdown": {
      "dental": {"used": 300, "budget": 630},
      "english": {"used": 200, "budget": 420},
      "other": {"used": 60, "budget": 120}
    },
    "suggestions": ["具体建议1", "具体建议2"]
  }
}

分析要点：
- 完成率（完成/总任务数 + 完成度）
- 专注时长 vs 预算
- 失败任务的原因模式
- 效率提升建议（方法而非时间）`;

const SCHEDULER_PROMPT = `你是日程规划专家。基于前面的分析结果，制定明日完整安排。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "schedule": {
    "dailyTasks": [
      {"name": "任务名", "category": "dental", "plannedMinutes": 60, "priority": "high", "reason": "完成第3章学习"}
    ],
    "fitnessTasks": [
      {"name": "慢跑30分钟", "type": "cardio", "calories": 300, "reason": "休息日有氧"}
    ],
    "weeklyPlan": {
      "focusAreas": ["重点领域1"],
      "weeklyGoals": "本周总体目标"
    }
  }
}

规划原则：
- dailyTasks: category只能是 english/dental/other
- fitnessTasks: type只能是 push/pull/legs/rest/cardio
- 任务量不超过预算配额
- 优先安排未完成或效率低的部分
- 学习任务用「任务名」格式，不要加分类前缀
- weeklyPlan 仅在周末(周六/周日)输出`;

const VALIDATOR_PROMPT = `你是输出校验专家。检查日程安排的合理性并打分。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "validation": {
    "score": 85,
    "passed": true,
    "issues": ["问题1"],
    "warnings": ["警告1"]
  }
}

校验标准：
- dailyTasks 的 category 必须是 english/dental/other
- fitnessTasks 的 type 必须是 push/pull/legs/rest/cardio
- plannedMinutes 不能为0
- 每天总任务量不超过8小时
- 分类配额是否合理
- 评分: 90-100优秀, 80-89合格, <80需要修订
- passed 仅当 score > 80`;

const FORMATTER_PROMPT = `你是格式整理专家。将输入的日程数据整理成标准 JSON 格式。

输出严格 JSON 格式（不要输出任何多余文字，不要 markdown 标记）：
{
  "version": "1.0",
  "timestamp": "当前时间ISO格式",
  "score": 0,
  "diagnosis": {
    "nutrition": { "calorieStatus": "", "proteinAdequacy": "", "issues": [], "suggestions": [] },
    "fitness": { "progressStatus": "", "volumeAnalysis": "", "suggestions": [] },
    "study": { "efficiencyScore": 0, "bottlenecks": [], "categoryBreakdown": {}, "suggestions": [] }
  },
  "schedule": {
    "dailyTasks": [],
    "fitnessTasks": [],
    "weeklyPlan": null
  },
  "warnings": []
}

整理规则：
1. 合并不完整数据
2. 删除无法解析的内容
3. 确保所有字段存在
4. 验证 category/type 取值合法
5. 设置 version 为 "1.0"`;

export const AGENTS: Record<string, AgentConfig> = {
  nutrition: {
    name: 'nutrition',
    label: '饮食分析',
    systemPrompt: NUTRITION_PROMPT,
    providerId: 'deepseek-v4',
  },
  fitness: {
    name: 'fitness',
    label: '健身分析',
    systemPrompt: FITNESS_PROMPT,
    providerId: 'deepseek-v4',
  },
  study: {
    name: 'study',
    label: '学习分析',
    systemPrompt: STUDY_PROMPT,
    providerId: 'deepseek-v4',
  },
  scheduler: {
    name: 'scheduler',
    label: '综合安排',
    systemPrompt: SCHEDULER_PROMPT,
    providerId: 'deepseek-v4',
  },
  validator: {
    name: 'validator',
    label: '校验评分',
    systemPrompt: VALIDATOR_PROMPT,
    providerId: 'deepseek-v4',
  },
  formatter: {
    name: 'formatter',
    label: '格式整理',
    systemPrompt: FORMATTER_PROMPT,
    providerId: 'siliconflow-r1',
  },
};

/** 构建某个 Agent 的完整用户 prompt */
export function buildAnalysisPrompt(_agent: AgentConfig['name'], context: string, previousResults?: string): string {
  const base = `数据上下文:\n${context}`;
  if (previousResults) {
    return `${base}\n\n前面分析结果:\n${previousResults}\n\n请基于以上信息给出你的分析。`;
  }
  return `${base}\n\n请基于以上数据给出你的分析。`;
}

/** 从 AI 返回文本中提取 JSON */
export function extractJSON(text: string): object | null {
  // 尝试直接解析
  try { return JSON.parse(text); } catch { /* try harder */ }

  // 提取 JSON 块
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* nope */ }
  }

  return null;
}

/** 合并所有 Agent 结果成最终输出 */
export function mergeResults(nutrition: any, fitness: any, study: any, schedule: any, validation: any): AIFinalOutput {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    score: validation?.validation?.score ?? 0,
    diagnosis: {
      nutrition: nutrition?.nutrition || { calorieStatus: '', proteinAdequacy: '', issues: [], suggestions: [] },
      fitness: fitness?.fitness || { progressStatus: '', volumeAnalysis: '', suggestions: [] },
      study: study?.study || { efficiencyScore: 0, bottlenecks: [], categoryBreakdown: {}, suggestions: [] },
    },
    schedule: {
      dailyTasks: schedule?.schedule?.dailyTasks || [],
      fitnessTasks: schedule?.schedule?.fitnessTasks || [],
      weeklyPlan: schedule?.schedule?.weeklyPlan || undefined,
    },
    warnings: validation?.validation?.warnings || [],
  };
}
