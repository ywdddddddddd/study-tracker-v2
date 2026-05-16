import { useState, useRef, useCallback } from 'react';

// Primary: DeepSeek V4 Pro (thinking model)
const PRIMARY_URL = 'https://api.deepseek.com/chat/completions';
const PRIMARY_KEY = import.meta.env.VITE_DEEPSEEK_KEY || '';
const PRIMARY_MODEL = 'deepseek-v4-pro';

const FALLBACK_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const FALLBACK_KEY = import.meta.env.VITE_SILICONFLOW_KEY || '';
const FALLBACK_MODEL = 'deepseek-ai/DeepSeek-R1';

// Errors that trigger fallback: timeout, rate limit, insufficient balance
const FALLBACK_STATUSES = new Set([408, 429, 402]);

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [reasoning, setReasoning] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const callAPI = useCallback(async (
    url: string,
    key: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    useThinking: boolean,
    signal: AbortSignal,
    onReasoning: (text: string) => void,
    onContent: (text: string) => void,
  ): Promise<string> => {
    const body: Record<string, any> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      max_tokens: 4096,
    };

    // DeepSeek thinking params (only for primary model)
    if (useThinking) {
      body.thinking = { type: 'enabled' };
      body.reasoning_effort = 'max';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Trigger fallback for specific status codes
      if (FALLBACK_STATUSES.has(res.status)) {
        throw new Error(`FALLBACK:${res.status}:${errText}`);
      }
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let fullReasoning = '';

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
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              onContent(fullText);
            }
            if (delta?.reasoning_content) {
              fullReasoning += delta.reasoning_content;
              onReasoning(fullReasoning);
            }
          } catch {
            // ignore parse errors for incomplete chunks
          }
        }
      }
    }

    return fullText;
  }, []);

  const sendMessage = useCallback(async (systemPrompt: string, userPrompt: string, onChunk?: (text: string, reasoningText: string) => void) => {
    setIsLoading(true);
    setContent('');
    setReasoning('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const onReasoning = (r: string) => {
      setReasoning(r);
      onChunk?.(content, r);
    };
    const onContent = (c: string) => {
      setContent(c);
      onChunk?.(c, reasoning);
    };

    const attemptCall = async (usePrimary: boolean): Promise<string> => {
      const url = usePrimary ? PRIMARY_URL : FALLBACK_URL;
      const key = usePrimary ? PRIMARY_KEY : FALLBACK_KEY;
      const model = usePrimary ? PRIMARY_MODEL : FALLBACK_MODEL;
      const useThinking = usePrimary; // Only primary model supports thinking params

      try {
        return await callAPI(url, key, model, systemPrompt, userPrompt, useThinking, abortRef.current!.signal, onReasoning, onContent);
      } catch (e: any) {
        if (e.name === 'AbortError') return '';
        if (usePrimary && e.message?.startsWith('FALLBACK:')) {
          // Switch to fallback
          setContent('');
          setReasoning('');
          return await attemptCall(false);
        }
        throw e;
      }
    };

    try {
      const result = await attemptCall(true);
      return result;
    } catch (e: any) {
      if (e.name === 'AbortError') return '';
      setContent(`错误: ${e.message}`);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [callAPI, content, reasoning]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { isLoading, content, reasoning, sendMessage, abort, setContent, setReasoning };
}
