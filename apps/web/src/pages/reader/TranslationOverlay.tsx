import type { ReactElement } from 'react';
import { Chip } from '@heroui/react';
import type { BilingualParagraph } from './mock-data';

interface TranslationOverlayProps {
  paragraphs: BilingualParagraph[];
  mode: 'bilingual' | 'multilingual' | 'off';
}

export function TranslationOverlay({ paragraphs, mode }: TranslationOverlayProps): ReactElement {
  if (mode === 'off') {
    return (
      <div className="space-y-4">
        {paragraphs.map((p) => (
          <p key={p.index} className="text-foreground leading-relaxed">
            {p.original}
          </p>
        ))}
      </div>
    );
  }

  if (mode === 'multilingual') {
    return (
      <div className="space-y-4">
        {paragraphs.map((p) => (
          <div key={p.index} className="grid grid-cols-2 gap-4 border-b border-border pb-4 last:border-b-0">
            <p className="text-foreground leading-relaxed">{p.original}</p>
            <div>
              <Chip size="sm" variant="soft" className="mb-1">{p.language}</Chip>
              <p className="text-muted leading-relaxed">{p.translated}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // bilingual mode
  return (
    <div className="space-y-6">
      {paragraphs.map((p) => (
        <div key={p.index} className="space-y-2">
          <p className="text-foreground leading-relaxed">{p.original}</p>
          <div className="flex items-start gap-2">
            <Chip size="sm" variant="soft" className="shrink-0 mt-0.5">{p.language}</Chip>
            <p className="text-muted leading-relaxed">{p.translated}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
