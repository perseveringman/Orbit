// ---------------------------------------------------------------------------
// InputFooter – Model name · tool count · token count status bar
// ---------------------------------------------------------------------------

import React from 'react';

export interface InputFooterProps {
  readonly modelName?: string;
  readonly toolCount?: number;
  readonly tokenCount?: number;
}

export const InputFooter = React.memo(function InputFooter({
  modelName,
  toolCount,
  tokenCount,
}: InputFooterProps) {
  const segments: string[] = [];
  if (modelName) segments.push(modelName);
  if (toolCount != null) segments.push(`${toolCount} 工具`);
  if (tokenCount != null) segments.push(`${tokenCount.toLocaleString()} tokens`);

  if (segments.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-muted">
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>{seg}</span>
        </React.Fragment>
      ))}
    </div>
  );
});
