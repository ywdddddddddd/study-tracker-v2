import { useState, useRef, useCallback } from 'react';

const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const API_KEY = 'sk-lldpkkegjmpexefnwqijwkouvijszfnuzamqxofutkkzirro';
const MODEL = 'deepseek-ai/DeepSeek-R1';

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [reasoning, setReasoning] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (systemPrompt: string, userPrompt: string, onChunk?: (text: string, reasoningText: string) => void) => {
    setIsLoading(true);
    setContent('');
    setReasoning('');
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
          max_tokens: 4096,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API error: ${err}`);
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
                setContent(fullText);
                onChunk?.(fullText, fullReasoning);
              }
              if (delta?.reasoning_content) {
                fullReasoning += delta.reasoning_content;
                setReasoning(fullReasoning);
                onChunk?.(fullText, fullReasoning);
              }
            } catch {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }

      return fullText;
    } catch (e: any) {
      if (e.name === 'AbortError') return '';
      setContent(`错误: ${e.message}`);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { isLoading, content, reasoning, sendMessage, abort, setContent, setReasoning };
}
