import type { ReactNode } from "react";

import { Chip } from "@heroui/react";

export type StatusColor = "success" | "warning" | "danger" | "accent" | "default";

export interface StatusChipProps {
  label: string;
  color: StatusColor;
  icon?: ReactNode;
}

const statusColorMap: Record<string, StatusColor> = {
  done: "success",
  active: "success",
  ready: "success",
  blocked: "warning",
  paused: "warning",
  clarifying: "warning",
  dropped: "danger",
  error: "danger",
  failed: "danger",
  focused: "accent",
  scheduled: "accent",
  reading: "accent",
  captured: "default",
  draft: "default",
  archived: "default",
};

export function getStatusColor(status: string): StatusColor {
  return statusColorMap[status.toLowerCase()] ?? "default";
}

export function StatusChip({ label, color, icon }: StatusChipProps) {
  return (
    <Chip size="sm" variant="soft" color={color}>
      {icon}
      {label}
    </Chip>
  );
}
