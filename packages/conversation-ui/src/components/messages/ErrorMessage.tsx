// ---------------------------------------------------------------------------
// ErrorMessage – Danger-bordered card with retry action
// ---------------------------------------------------------------------------

import React from 'react';
import { Card, Button } from '@heroui/react';
import type { RenderableMessage } from '../../types.js';

export interface ErrorMessageProps {
  readonly message: RenderableMessage;
  readonly onRetry?: () => void;
}

/** Inline error icon (circle-exclamation). */
function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5 text-danger flex-shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export const ErrorMessage = React.memo<ErrorMessageProps>(
  function ErrorMessage({ message, onRetry }) {
    return (
      <Card className="border-danger border shadow-sm" data-testid={`error-${message.id}`}>
        <Card.Content className="flex items-start gap-3 p-4">
          <ErrorIcon />
          <div className="min-w-0 flex-1">
            <p className="text-danger text-sm font-medium mb-0.5">Error</p>
            <p className="text-default-600 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          </div>
        </Card.Content>

        {onRetry && (
          <Card.Footer className="justify-end px-4 pb-3 pt-0">
            <Button size="sm" variant="ghost" className="text-danger" onPress={onRetry}>
              重试
            </Button>
          </Card.Footer>
        )}
      </Card>
    );
  },
);
