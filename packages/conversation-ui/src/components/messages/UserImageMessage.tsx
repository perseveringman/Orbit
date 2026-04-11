// ---------------------------------------------------------------------------
// UserImageMessage – User bubble that optionally renders an attached image
// ---------------------------------------------------------------------------

import React from 'react';
import type { RenderableMessage } from '../../types.js';
import { UserTextMessage } from './UserTextMessage.js';

export interface UserImageMessageProps {
  readonly message: RenderableMessage;
  readonly searchQuery?: string;
}

export const UserImageMessage = React.memo<UserImageMessageProps>(
  function UserImageMessage({ message, searchQuery }) {
    const imageUrl = (message.metadata?.imageUrl as string) ?? undefined;

    // Fall back to plain text bubble when there is no image
    if (!imageUrl) {
      return <UserTextMessage message={message} searchQuery={searchQuery} />;
    }

    return (
      <div className="self-end max-w-[80%]" data-testid={`user-image-${message.id}`}>
        <div className="rounded-2xl rounded-br-sm bg-accent text-accent-foreground px-4 py-2.5 shadow-sm">
          <img
            src={imageUrl}
            alt={message.content || 'User-attached image'}
            className="rounded-lg max-h-64 w-auto object-contain mb-2"
            loading="lazy"
          />
          {message.content && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </p>
          )}
        </div>
        <time
          className="block text-[10px] text-muted mt-1 text-right mr-1"
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
