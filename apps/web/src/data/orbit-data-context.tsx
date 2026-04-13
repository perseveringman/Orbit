import { createContext, useContext, useState, useEffect, type ReactNode, type ReactElement } from 'react';
import type { DatabasePort } from '@orbit/platform-contracts';
import { initializeDatabase, createRepositories, type OrbitRepositories } from '@orbit/db-runtime';
import { createBrowserDatabasePort } from './browser-database-port';
import { seedDatabase } from './seed-data';

interface OrbitDataContextValue {
  db: DatabasePort;
  repos: OrbitRepositories;
  /** Increment to trigger re-queries across all hooks */
  version: number;
  /** Call after any mutation to trigger re-renders */
  invalidate: () => void;
}

const OrbitDataContext = createContext<OrbitDataContextValue | null>(null);

export function OrbitDataProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<OrbitDataContextValue | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await createBrowserDatabasePort();
        initializeDatabase(db);
        const repos = createRepositories(db);
        seedDatabase(db);
        if (!cancelled) {
          setState({
            db,
            repos,
            version: 0,
            invalidate: () => {
              setState((prev) => (prev ? { ...prev, version: prev.version + 1 } : prev));
            },
          });
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-danger">
        <p>数据库初始化失败: {error.message}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <p>正在初始化数据库…</p>
      </div>
    );
  }

  return <OrbitDataContext.Provider value={state}>{children}</OrbitDataContext.Provider>;
}

export function useOrbitData(): OrbitDataContextValue {
  const ctx = useContext(OrbitDataContext);
  if (!ctx) throw new Error('useOrbitData must be used within OrbitDataProvider');
  return ctx;
}
