export type OrbitThemeMode = 'light' | 'dark';

function syncDocumentThemeMode(mode: OrbitThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.remove(mode === 'light' ? 'dark' : 'light');
  root.classList.add(mode);
}

/** Switches theme by updating class + data-theme on <html> and persisting to localStorage. */
export function setTheme(mode: OrbitThemeMode): void {
  if (typeof document === 'undefined') return;
  syncDocumentThemeMode(mode);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('orbit-theme', mode);
  }
}

/** Gets the current theme from document or localStorage, falling back to 'light'. */
export function getCurrentTheme(): OrbitThemeMode {
  if (typeof document !== 'undefined') {
    const { documentElement } = document;
    if (documentElement.dataset.theme === 'light' || documentElement.dataset.theme === 'dark') {
      return documentElement.dataset.theme;
    }
    if (documentElement.classList.contains('dark')) {
      return 'dark';
    }
    if (documentElement.classList.contains('light')) {
      return 'light';
    }
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('orbit-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'light';
}
