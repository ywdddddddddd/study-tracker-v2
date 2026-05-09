import { createContext, useContext, useRef, useCallback, useEffect } from 'react';

type SaveFn = () => Promise<unknown>;

interface TabGuardContextValue {
  registerSave: (tab: string, saveFn: SaveFn) => void;
  unregisterSave: (tab: string) => void;
  saveBeforeLeave: (tab: string) => Promise<void>;
}

export const TabGuardContext = createContext<TabGuardContextValue>({
  registerSave: () => {},
  unregisterSave: () => {},
  saveBeforeLeave: async () => {},
});

export function useTabGuard() {
  return useContext(TabGuardContext);
}

export function useRegisterSave(tab: string, saveFn: SaveFn | null) {
  const { registerSave, unregisterSave } = useTabGuard();
  const saveRef = useRef(saveFn);
  saveRef.current = saveFn;

  const wrapped = useCallback(async () => {
    if (saveRef.current) await saveRef.current();
  }, []);

  useEffect(() => {
    registerSave(tab, wrapped);
    return () => unregisterSave(tab);
  }, [tab, wrapped, registerSave, unregisterSave]);
}
