import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  data: T;
  saveFn: (data: T) => Promise<void>;
  isLoaded: boolean;  // 数据是否加载完成（防止初始化触发了脏标记）
  enabled?: boolean;  // 是否启用自动保存，默认 true
}

export function useAutoSave<T>({ data, saveFn, isLoaded, enabled = true }: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const prevDataRef = useRef<string>('');
  const savingRef = useRef(false);
  const versionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always point to latest data to prevent stale closure issues
  const dataRef = useRef(data);
  dataRef.current = data;
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const loadedRef = useRef(isLoaded);
  loadedRef.current = isLoaded;

  // 追踪数据变化
  useEffect(() => {
    if (!isLoaded || !enabled) return;
    const serialized = JSON.stringify(data);
    if (serialized !== prevDataRef.current && prevDataRef.current !== '') {
      setStatus('dirty');
    }
    prevDataRef.current = serialized;
  }, [data, isLoaded, enabled]);

  // 离开时自动保存
  useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = () => {
      if (status === 'dirty' || status === 'saving') {
        const serialized = JSON.stringify(data);
        navigator.sendBeacon?.('/api/beacon', serialized);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status, data, enabled]);

  const save = useCallback(async () => {
    if (savingRef.current || !loadedRef.current || !enabled) return;
    savingRef.current = true;
    const currentVersion = ++versionRef.current;
    setStatus('saving');

    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await saveFnRef.current(dataRef.current);
      if (currentVersion === versionRef.current) {
        setStatus('saved');
        timerRef.current = setTimeout(() => {
          setStatus(s => s === 'saved' ? 'idle' : s);
        }, 3000);
      }
      return true;
    } catch (err) {
      if (currentVersion === versionRef.current) {
        setStatus('error');
      }
      throw err;
    } finally {
      savingRef.current = false;
    }
  }, [enabled]); // Only depends on enabled; reads data/saveFn/isLoaded from refs

  const markDirty = useCallback(() => {
    if (isLoaded && enabled) setStatus('dirty');
  }, [isLoaded, enabled]);

  return { status, save, markDirty, setStatus };
}
