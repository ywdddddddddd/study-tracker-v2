import { getEnabledProviders, getAgentProvider } from './settings-store';
import type { AgentName } from './types';

/** 通用 LLM 调用，支持流式和非流式 */
export async function callLLM(
  providerId: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    stream?: boolean;
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const providers = getEnabledProviders();
  const provider = providers.find(p => p.id === providerId);
  if (!provider) throw new Error(`Provider ${providerId} not found or disabled`);

  const isStreaming = options?.stream ?? true;
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: isStreaming,
    max_tokens: options?.maxTokens ?? provider.defaultParams.maxTokens,
    temperature: options?.temperature ?? provider.defaultParams.temperature,
    top_p: provider.defaultParams.topP,
  };

  const res = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${errText}`);
  }

  if (!isStreaming) {
    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  }

  // Streaming
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            options?.onChunk?.(fullText);
          }
        } catch { /* ignore partial chunks */ }
      }
    }
  }

  return fullText;
}

/** 为指定 Agent 调用 LLM */
export async function callAgent(
  agent: AgentName,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    stream?: boolean;
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
  }
): Promise<string> {
  const provider = getAgentProvider(agent);
  if (!provider) throw new Error(`No enabled provider for agent: ${agent}`);
  return callLLM(provider.id, systemPrompt, userPrompt, options);
}

/** 非流式调用（给 formatter/validator 用） */
export async function callLLMNonStreaming(
  providerId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  return callLLM(providerId, systemPrompt, userPrompt, { stream: false });
}
