import { useState, type ReactElement } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@heroui/react';

type TranslationMode = 'off' | 'bilingual' | 'multilingual' | 'terminology';

const MODE_LABELS: Record<TranslationMode, string> = {
  off: '关闭',
  bilingual: '段落双语',
  multilingual: '多语并存',
  terminology: '术语优先',
};

const MODES: TranslationMode[] = ['off', 'bilingual', 'multilingual', 'terminology'];

const LANGUAGES = ['中文', 'English', '日本語', 'Deutsch', 'Français'];

export function TranslationToggle(): ReactElement {
  const [mode, setMode] = useState<TranslationMode>('off');
  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('中文');

  const cycleMode = () => {
    const idx = MODES.indexOf(mode);
    setMode(MODES[(idx + 1) % MODES.length]);
  };

  const showLangSelectors = mode === 'bilingual' || mode === 'multilingual';

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onPress={cycleMode}>
        <Languages size={14} />
        <span className="text-xs">{MODE_LABELS[mode]}</span>
      </Button>

      {showLangSelectors && (
        <div className="flex items-center gap-1 text-xs">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <span className="text-muted">→</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-foreground"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
