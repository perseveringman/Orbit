import type { ReactNode } from "react";

import { Chip } from "@heroui/react";

export interface NavItemProps {
  icon: ReactNode;
  label: string;
  badge?: number | string;
  isActive: boolean;
  onClick: () => void;
}

export function NavItem({ icon, label, badge, isActive, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
        isActive
          ? "border-l-2 border-accent bg-accent-soft text-accent font-medium"
          : "text-muted hover:bg-surface-secondary"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge != null && (
        <Chip size="sm" variant="soft">
          {badge}
        </Chip>
      )}
    </button>
  );
}
