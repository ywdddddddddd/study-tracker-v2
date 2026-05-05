import { useState, useRef, useCallback, useEffect } from 'react';

interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
}

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    isPaused: false,
    elapsedSeconds: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const start = useCallback(() => {
    if (state.isRunning) return;
    startTimeRef.current = Date.now();
    pausedElapsedRef.current = state.elapsedSeconds;
    setState(s => ({ ...s, isRunning: true, isPaused: false }));
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = pausedElapsedRef.current + Math.floor((now - startTimeRef.current) / 1000);
      setState(s => ({ ...s, elapsedSeconds: elapsed }));
    }, 1000);
  }, [state.isRunning, state.elapsedSeconds]);

  const pause = useCallback(() => {
    if (!state.isRunning || state.isPaused) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    pausedElapsedRef.current = state.elapsedSeconds;
    setState(s => ({ ...s, isPaused: true, isRunning: false }));
  }, [state.isRunning, state.isPaused, state.elapsedSeconds]);

  const resume = useCallback(() => {
    if (!state.isPaused) return;
    startTimeRef.current = Date.now();
    setState(s => ({ ...s, isPaused: false, isRunning: true }));
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = pausedElapsedRef.current + Math.floor((now - startTimeRef.current) / 1000);
      setState(s => ({ ...s, elapsedSeconds: elapsed }));
    }, 1000);
  }, [state.isPaused]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const final = state.elapsedSeconds;
    setState({ isRunning: false, isPaused: false, elapsedSeconds: 0 });
    pausedElapsedRef.current = 0;
    return final;
  }, [state.elapsedSeconds]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState({ isRunning: false, isPaused: false, elapsedSeconds: 0 });
    pausedElapsedRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { ...state, start, pause, resume, stop, reset };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
