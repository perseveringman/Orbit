// ---------------------------------------------------------------------------
// SystemMessage – Subtle left-bordered system notification
// ---------------------------------------------------------------------------

import React from 'react';
import type { RenderableMessage } from '../../types.js';

export interface SystemMessageProps {
  readonly message: RenderableMessage;
}

export const SystemMessage = React.memo<SystemMessageProps>(
  function SystemMessage({ message }) {
    return (
      <div
        className="border-l-2 border-default-300 pl-3 py-1.5 my-1"
        data-testid={`system-${message.id}`}
      >
        <p className="text-default-400 text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </p>
        <time
          className="block text-[10px] text-default-300 mt-1"
          dateTime={message.timestamp}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    );
  },
);
