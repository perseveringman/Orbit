import React from 'react';
import { Button, Card } from '@heroui/react';

import type { RenderableMessage } from '../../types.js';

export interface PermissionApprovalProps {
  readonly message: RenderableMessage;
  readonly onApprove?: (id: string) => void;
  readonly onReject?: (id: string) => void;
}

export const PermissionApproval = React.memo(function PermissionApproval({
  message,
  onApprove,
  onReject,
}: PermissionApprovalProps) {
  return (
    <Card className="border-warning shadow-sm">
      <Card.Header>
        <Card.Title className="text-warning text-sm font-semibold">
          ⚠ 权限请求
        </Card.Title>
      </Card.Header>

      <Card.Content className="pt-0">
        <p className="text-default-700 text-sm whitespace-pre-wrap">
          {message.content}
        </p>
      </Card.Content>

      <Card.Footer className="flex gap-2 pt-2">
        <Button
          variant="primary"
          size="sm"
          onPress={() => onApprove?.(message.id)}
        >
          允许
        </Button>
        <Button
          variant="danger"
          size="sm"
          onPress={() => onReject?.(message.id)}
        >
          拒绝
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => onApprove?.(message.id)}
        >
          始终允许
        </Button>
      </Card.Footer>
    </Card>
  );
});
