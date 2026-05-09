import { useState, useEffect } from 'react';
import { getProviders, saveProvider, deleteProvider, saveAgentMap, resetToDefaults } from '../../lib/ai/settings-store';
import type { LLMProvider, AgentProviderMap, AgentName } from '../../lib/ai/types';
import type { ProviderType } from '../../lib/ai/types';
import { DEFAULT_AGENT_MAP } from '../../lib/ai/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2, CheckCircle, RotateCcw } from 'lucide-react';

const AGENT_LABELS: Record<AgentName, string> = {
  nutrition: '饮食分析',
  fitness: '健身分析',
  study: '学习分析',
  scheduler: '综合安排',
  validator: '校验评分',
  formatter: '格式整理',
};

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'siliconflow', label: 'SiliconFlow' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'custom', label: '自定义' },
];

export default function LLMSettings() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [agentMap, setAgentMap] = useState<AgentProviderMap>(DEFAULT_AGENT_MAP);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LLMProvider | null>(null);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(function () {
    loadSettings();
  }, []);

  function loadSettings() {
    setProviders(getProviders());
    try {
      const raw = localStorage.getItem('study-tracker-llm-settings');
      if (raw) {
        const s = JSON.parse(raw);
        setAgentMap(s.agentMap || DEFAULT_AGENT_MAP);
      }
    } catch { /* ignore */ }
  }

  function startEdit(provider?: LLMProvider) {
    setEditing(provider ? { ...provider } : {
      id: 'custom-' + Date.now(),
      name: '新Provider',
      provider: 'custom',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-4o',
      defaultParams: { temperature: 0.7, maxTokens: 4096, topP: 0.9 },
      enabled: true,
    });
    setEditingId(provider?.id || null);
  }

  function handleSave() {
    if (!editing) return;
    saveProvider(editing);
    setEditing(null);
    setEditingId(null);
    loadSettings();
  }

  function handleDelete(id: string) {
    if (!confirm('删除此Provider？')) return;
    deleteProvider(id);
    loadSettings();
  }

  async function handleTest(provider: LLMProvider) {
    setTestResult('测试中...');
    try {
      const res = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + provider.apiKey,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: '回复"OK"' }],
          max_tokens: 5,
        }),
      });
      if (res.ok) {
        setTestResult('✅ 连接成功 (' + provider.name + ')');
      } else {
        setTestResult('❌ HTTP ' + res.status + ': ' + (await res.text()).slice(0, 100));
      }
    } catch (e: any) {
      setTestResult('❌ 网络错误: ' + e.message);
    }
    setTimeout(function () { setTestResult(''); }, 5000);
  }

  function handleAgentChange(agent: AgentName, providerId: string) {
    const newMap = { ...agentMap, [agent]: providerId };
    setAgentMap(newMap);
    saveAgentMap({ [agent]: providerId });
  }

  return (
    <div className="space-y-6">
      {/* Providers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>LLM Providers</span>
            <Button size="sm" onClick={function () { startEdit(); }}>
              <Plus className="w-3 h-3 mr-1" />添加Provider
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map(function (p) {
            const isEditing = editingId === p.id;
            const data = isEditing && editing ? editing : p;
            return (
              <div key={p.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={p.enabled ? 'text-emerald-600' : 'text-muted-foreground'}>
                      <CheckCircle className="w-4 h-4" />
                    </span>
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.provider}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={function () { startEdit(p); }}>
                      编辑
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={function () { handleTest(p); }}>
                      测试
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={function () { handleDelete(p.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">名称</label>
                      <Input value={data.name} onChange={function (e) { setEditing({ ...data, name: e.target.value }); }} className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">类型</label>
                      <select value={data.provider} onChange={function (e) { setEditing({ ...data, provider: e.target.value as ProviderType }); }} className="h-7 w-full text-xs rounded border px-1">
                        {PROVIDER_TYPES.map(function (pt) { return <option key={pt.value} value={pt.value}>{pt.label}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">API URL</label>
                      <Input value={data.apiUrl} onChange={function (e) { setEditing({ ...data, apiUrl: e.target.value }); }} className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Model</label>
                      <Input value={data.model} onChange={function (e) { setEditing({ ...data, model: e.target.value }); }} className="h-7 text-xs" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground">API Key</label>
                      <Input type="password" value={data.apiKey} onChange={function (e) { setEditing({ ...data, apiKey: e.target.value }); }} className="h-7 text-xs" placeholder="sk-..." />
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <Button size="sm" onClick={handleSave}>保存</Button>
                      <Button variant="outline" size="sm" onClick={function () { setEditing(null); setEditingId(null); }}>取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground truncate">
                    {p.model} @ {p.apiUrl.slice(0, 40)}...
                  </div>
                )}
              </div>
            );
          })}

          {/* New provider form */}
          {editing && editingId === null && (
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium text-primary">新建 Provider</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">名称</label>
                  <Input value={editing.name} onChange={function (e) { setEditing({ ...editing, name: e.target.value }); }} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">类型</label>
                  <select value={editing.provider} onChange={function (e) { setEditing({ ...editing, provider: e.target.value as ProviderType }); }} className="h-7 w-full text-xs rounded border px-1">
                    {PROVIDER_TYPES.map(function (pt) { return <option key={pt.value} value={pt.value}>{pt.label}</option>; })}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">API URL</label>
                  <Input value={editing.apiUrl} onChange={function (e) { setEditing({ ...editing, apiUrl: e.target.value }); }} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Model</label>
                  <Input value={editing.model} onChange={function (e) { setEditing({ ...editing, model: e.target.value }); }} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">API Key</label>
                  <Input type="password" value={editing.apiKey} onChange={function (e) { setEditing({ ...editing, apiKey: e.target.value }); }} className="h-7 text-xs" placeholder="sk-..." />
                </div>
                <div className="col-span-2 flex gap-2">
                  <Button size="sm" onClick={handleSave}>保存</Button>
                  <Button variant="outline" size="sm" onClick={function () { setEditing(null); setEditingId(null); }}>取消</Button>
                </div>
              </div>
            </div>
          )}

          {testResult && (
            <div className="text-xs p-2 rounded bg-muted">
              {testResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Mapping */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Agent Provider 映射</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(Object.keys(AGENT_LABELS) as AgentName[]).map(function (agent) {
              return (
                <div key={agent} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{AGENT_LABELS[agent]}</span>
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <select
                    value={agentMap[agent] || ''}
                    onChange={function (e) { handleAgentChange(agent, e.target.value); }}
                    className="h-8 text-xs rounded border px-2"
                  >
                    {providers.filter(function (p) { return p.enabled; }).map(function (p) {
                      return <option key={p.id} value={p.id}>{p.name}</option>;
                    })}
                  </select>
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={resetToDefaults}>
            <RotateCcw className="w-3 h-3 mr-1" />恢复默认
          </Button>
        </CardContent>
      </Card>

      {/* Safety note */}
      <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
        ⚠️ API Key 仅存储在您的浏览器本地（localStorage），不会上传到任何服务器。
        更换设备或清除浏览器数据后需要重新配置。
      </div>
    </div>
  );
}
