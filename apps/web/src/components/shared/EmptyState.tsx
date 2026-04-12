import type { ReactNode } from "react";

import { Button } from "@heroui/react";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-muted [&>svg]:size-12">{icon}</div>
      <h3 className="text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-6" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
