import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode, type ReactElement } from 'react';
import type { DatabasePort } from '@orbit/platform-contracts';
import { initializeDatabase, createRepositories, type OrbitRepositories } from '@orbit/db-runtime';
import { createBrowserDatabasePort } from './browser-database-port';
import { seedDatabase } from './seed-data';

export interface OrbitDataContextValue {
  db: DatabasePort | null;
  repos: OrbitRepositories | null;
  /** Increment to trigger re-queries across all hooks */
  version: number;
  /** Call after any mutation to trigger re-renders */
  invalidate: () => void;
  /** Whether the database has finished initializing */
  ready: boolean;
  /** Initialization error, if any */
  error: Error | null;
}

const OrbitDataContext = createContext<OrbitDataContextValue>({
  db: null,
  repos: null,
  version: 0,
  invalidate: () => {},
  ready: false,
  error: null,
});

export function OrbitDataProvider({ children }: { children: ReactNode }): ReactElement {
  const [db, setDb] = useState<DatabasePort | null>(null);
  const [repos, setRepos] = useState<OrbitRepositories | null>(null);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);

  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    // Guard against StrictMode double-init
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        console.log('[OrbitData] Initializing sql.js WASM…');
        const database = await createBrowserDatabasePort();
        console.log('[OrbitData] WASM loaded, bootstrapping schema…');
        initializeDatabase(database);
        console.log('[OrbitData] Schema ready, seeding data…');
        seedDatabase(database);
        const repositories = createRepositories(database);
        console.log('[OrbitData] Database ready ✓');
        setDb(database);
        setRepos(repositories);
        setReady(true);
      } catch (err) {
        console.error('[OrbitData] Initialization failed:', err);
        setError(err as Error);
      }
    })();
  }, []);

  const value: OrbitDataContextValue = {
    db,
    repos,
    version,
    invalidate,
    ready,
    error,
  };

  return <OrbitDataContext.Provider value={value}>{children}</OrbitDataContext.Provider>;
}

/**
 * Access the Orbit data context. Always safe to call — returns { ready: false }
 * while the database is initializing. Consumers should check `ready` before querying.
 */
export function useOrbitData(): OrbitDataContextValue {
  return useContext(OrbitDataContext);
}
