import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db.js';
import { seedIfEmpty } from './db/seed.js';
import { pendingCount } from './sync/outbox.js';
import { CruiseListScreen } from './screens/CruiseListScreen.js';
import { CruiseScreen } from './screens/CruiseScreen.js';
import { TallyScreen } from './screens/TallyScreen.js';
import { CompileScreen } from './screens/CompileScreen.js';

/**
 * Navigation is a piece of state, not a router.
 *
 * The field app has four screens and no deep links — a cruiser does not paste
 * URLs, and the app runs full-screen from the home screen where the address bar
 * does not exist. A router would be a dependency, a bundle, and a set of
 * behaviours (scroll restoration, history) that all have to be reasoned about
 * for no benefit yet. When sharing a cruise by link becomes a feature, this is
 * the file that changes.
 */
export type View =
  | { name: 'cruises' }
  | { name: 'cruise'; cruiseId: string }
  | { name: 'tally'; cruiseId: string; plotId: string }
  | { name: 'compile'; cruiseId: string };

export function App() {
  const [view, setView] = useState<View>({ name: 'cruises' });
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    void seedIfEmpty();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Reading through useLiveQuery rather than polling: Dexie notifies on write,
  // so the count is correct the instant a tree is tallied.
  const pending = useLiveQuery(() => pendingCount(), [], 0);

  const title =
    view.name === 'cruises'
      ? 'TimberForge'
      : view.name === 'compile'
        ? 'Compilation'
        : view.name === 'tally'
          ? 'Tally'
          : 'Cruise';

  return (
    <div className="app">
      <header className="bar">
        {view.name !== 'cruises' && (
          <button
            className="ghost"
            aria-label="Back"
            onClick={() =>
              setView(
                view.name === 'tally' || view.name === 'compile'
                  ? { name: 'cruise', cruiseId: view.cruiseId }
                  : { name: 'cruises' }
              )
            }
          >
            ‹
          </button>
        )}
        <h1>{title}</h1>
        {!online && <span className="pill offline">Offline</span>}
        {pending > 0 && (
          <span className="pill pending" title="Changes waiting to sync">
            {pending} queued
          </span>
        )}
      </header>

      <main>
        {view.name === 'cruises' && <CruiseListScreen onOpen={setView} />}
        {view.name === 'cruise' && <CruiseScreen cruiseId={view.cruiseId} onNavigate={setView} />}
        {view.name === 'tally' && (
          <TallyScreen cruiseId={view.cruiseId} plotId={view.plotId} onNavigate={setView} />
        )}
        {view.name === 'compile' && <CompileScreen cruiseId={view.cruiseId} />}
      </main>
    </div>
  );
}

/** Shared by the screens; keeps `db` out of their imports for simple reads. */
export { db };
