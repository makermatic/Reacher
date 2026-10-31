import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { connect, type Connection } from './connect';
import type { Json } from './store';

type RuntimeState = { status: 'connecting' } | ({ status: 'ready' } & Connection);

const RuntimeContext = createContext<RuntimeState>({ status: 'connecting' });

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RuntimeState>({ status: 'connecting' });
  useEffect(() => {
    let live = true;
    connect().then((c) => live && setState({ status: 'ready', ...c }));
    return () => {
      live = false;
    };
  }, []);
  return <RuntimeContext.Provider value={state}>{children}</RuntimeContext.Provider>;
}

export const useRuntime = () => useContext(RuntimeContext);

/**
 * Live value of one named document. `undefined` while loading, `null` when
 * it doesn't exist yet.
 */
export function useDoc<T extends Json>(name: string): T | null | undefined {
  const runtime = useRuntime();
  const store = runtime.status === 'ready' ? runtime.store : null;
  const [value, setValue] = useState<{ store: unknown; value: T | null } | undefined>();
  useEffect(() => {
    if (!store) return;
    return store.watchDoc<T>(name, (v) => setValue({ store, value: v }));
  }, [store, name]);
  return value && value.store === store ? value.value : undefined;
}
