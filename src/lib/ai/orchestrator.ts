import type { AIFinalOutput, ValidationResult, AnalysisStage } from './types';
import { callAgent, callLLMNonStreaming } from './providers';
import { AGENTS, buildAnalysisPrompt, extractJSON, mergeResults } from './agents';
import type { AgentName } from './types';

// ============ Orchestrator ============

const MAX_SCHEDULER_RETRIES = 3;
const PASS_THRESHOLD = 80;

export interface OrchestratorCallbacks {
  onStageChange: (stages: AnalysisStage[]) => void;
  onComplete: (result: AIFinalOutput) => void;
  onError: (error: Error, stage: string) => void;
  signal?: AbortSignal;
}

/** 运行全链条多 Agent 分析 */
export async function runFullAnalysis(
  context: string,
  callbacks: OrchestratorCallbacks
): Promise<AIFinalOutput> {
  const stages: AnalysisStage[] = [
    { agent: 'nutrition', status: 'pending', timestamp: '' },
    { agent: 'fitness', status: 'pending', timestamp: '' },
    { agent: 'study', status: 'pending', timestamp: '' },
    { agent: 'scheduler', status: 'pending', timestamp: '' },
    { agent: 'validator', status: 'pending', timestamp: '' },
    { agent: 'formatter', status: 'pending', timestamp: '' },
  ];

  const updateStage = (agent: string, update: Partial<AnalysisStage>) => {
    const idx = stages.findIndex(s => s.agent === agent);
    if (idx >= 0) {
      stages[idx] = { ...stages[idx], ...update, timestamp: new Date().toISOString() };
      callbacks.onStageChange([...stages]);
    }
  };

  try {
    // 1. Nutrition Analysis
    updateStage('nutrition', { status: 'running' });
    const nutritionText = await callAgent(
      'nutrition',
      AGENTS.nutrition.systemPrompt,
      buildAnalysisPrompt('nutrition', context),
      { signal: callbacks.signal }
    );
    const nutritionResult = extractJSON(nutritionText) || {};
    updateStage('nutrition', { status: 'completed', result: nutritionResult });

    // 2. Fitness Analysis
    updateStage('fitness', { status: 'running' });
    const fitnessText = await callAgent(
      'fitness',
      AGENTS.fitness.systemPrompt,
      buildAnalysisPrompt('fitness', context, JSON.stringify(nutritionResult)),
      { signal: callbacks.signal }
    );
    const fitnessResult = extractJSON(fitnessText) || {};
    updateStage('fitness', { status: 'completed', result: fitnessResult });

    // 3. Study Analysis
    updateStage('study', { status: 'running' });
    const studyText = await callAgent(
      'study',
      AGENTS.study.systemPrompt,
      buildAnalysisPrompt('study', context, JSON.stringify({ ...nutritionResult, ...fitnessResult })),
      { signal: callbacks.signal }
    );
    const studyResult = extractJSON(studyText) || {};
    updateStage('study', { status: 'completed', result: studyResult });

    // 4. Schedule (with retry loop)
    const allResults = JSON.stringify({ nutrition: nutritionResult, fitness: fitnessResult, study: studyResult });
    let scheduleResult: any = null;
    let validationResult: ValidationResult = { score: 0, passed: false, issues: [], warnings: [] };
    let retries = 0;

    while (retries <= MAX_SCHEDULER_RETRIES) {
      updateStage('scheduler', {
        status: 'running',
        result: retries > 0 ? { retry: retries, feedback: validationResult } : undefined,
      });

      const scheduleText = await callAgent(
        'scheduler',
        AGENTS.scheduler.systemPrompt,
        buildAnalysisPrompt('scheduler', context, `${allResults}${retries > 0 ? '\n\n上次校验问题:\n' + JSON.stringify(validationResult) : ''}`),
        { signal: callbacks.signal }
      );
      scheduleResult = extractJSON(scheduleText) || {};
      updateStage('scheduler', { status: 'completed', result: scheduleResult });

      // 5. Validate
      updateStage('validator', { status: 'running' });
      const tempOutput = mergeResults(nutritionResult, fitnessResult, studyResult, scheduleResult, { validation: validationResult });
      const validatorText = await callAgent(
        'validator',
        AGENTS.validator.systemPrompt,
        `请校验以下安排:\n${JSON.stringify(tempOutput, null, 2)}`,
        { signal: callbacks.signal }
      );
      const rawValidation = extractJSON(validatorText) || {};
      validationResult = rawValidation.validation || { score: 0, passed: false, issues: [], warnings: [] };
      updateStage('validator', { status: 'completed', result: { validation: validationResult } });

      if (validationResult.passed || retries >= MAX_SCHEDULER_RETRIES) break;
      retries++;
    }

    // 6. Format
    updateStage('formatter', { status: 'running' });
    const tempOutput = mergeResults(nutritionResult, fitnessResult, studyResult, scheduleResult, { validation: validationResult });
    const formatterText = await callAgent(
      'formatter',
      AGENTS.formatter.systemPrompt,
      `请整理以下数据为标准格式:\n${JSON.stringify(tempOutput, null, 2)}`,
      { stream: false, signal: callbacks.signal }
    );

    // Try formatter output first, fall back to mergeResults
    const formatted = extractJSON(formatterText);
    const finalOutput: AIFinalOutput = formatted && formatted.version
      ? formatted as unknown as AIFinalOutput
      : mergeResults(nutritionResult, fitnessResult, studyResult, scheduleResult, { validation: validationResult });

    finalOutput.score = validationResult.score;
    finalOutput.warnings = [
      ...finalOutput.warnings,
      ...(retries > 0 ? [`经过${retries}次修订`] : []),
      ...(validationResult.passed ? [] : ['校验未通过，建议人工审核']),
    ];

    updateStage('formatter', { status: 'completed', result: finalOutput });
    callbacks.onComplete(finalOutput);
    return finalOutput;

  } catch (e: any) {
    if (e.name === 'AbortError') throw e;
    callbacks.onError(e, stages.find(s => s.status === 'running')?.agent || 'unknown');
    throw e;
  }
}
