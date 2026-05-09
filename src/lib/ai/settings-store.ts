import type { LLMProvider, AgentProviderMap, AgentName } from './types';
import { DEFAULT_PROVIDERS, DEFAULT_AGENT_MAP } from './types';

const STORAGE_KEY = 'study-tracker-llm-settings';

interface LLMSettings {
  providers: LLMProvider[];
  agentMap: AgentProviderMap;
}

function load(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { providers: DEFAULT_PROVIDERS, agentMap: DEFAULT_AGENT_MAP };
}

function save(settings: LLMSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getProviders(): LLMProvider[] {
  return load().providers;
}

export function getEnabledProviders(): LLMProvider[] {
  return load().providers.filter(p => p.enabled);
}

export function getProvider(id: string): LLMProvider | undefined {
  return load().providers.find(p => p.id === id);
}

export function getAgentProvider(agent: AgentName): LLMProvider | undefined {
  const { providers, agentMap } = load();
  const providerId = agentMap[agent];
  return providers.find(p => p.id === providerId && p.enabled);
}

export function saveProvider(provider: LLMProvider) {
  const settings = load();
  const idx = settings.providers.findIndex(p => p.id === provider.id);
  if (idx >= 0) settings.providers[idx] = provider;
  else settings.providers.push(provider);
  save(settings);
}

export function deleteProvider(id: string) {
  const settings = load();
  settings.providers = settings.providers.filter(p => p.id !== id);
  // Clean up agent mapping
  for (const agent of Object.keys(settings.agentMap) as AgentName[]) {
    if (settings.agentMap[agent] === id) {
      const firstEnabled = settings.providers.find(p => p.enabled);
      settings.agentMap[agent] = firstEnabled?.id || 'deepseek-v4';
    }
  }
  save(settings);
}

export function saveAgentMap(map: Partial<AgentProviderMap>) {
  const settings = load();
  settings.agentMap = { ...settings.agentMap, ...map };
  save(settings);
}

export function resetToDefaults() {
  save({ providers: DEFAULT_PROVIDERS, agentMap: DEFAULT_AGENT_MAP });
}
