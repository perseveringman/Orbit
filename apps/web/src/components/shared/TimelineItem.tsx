import type { ReactNode } from "react";

export interface TimelineItemProps {
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  importance?: "hidden" | "normal" | "major";
}

export function TimelineItem({
  icon,
  iconColor,
  title,
  subtitle,
  timestamp,
  importance = "normal",
}: TimelineItemProps) {
  const importanceClass =
    importance === "major"
      ? "font-semibold"
      : importance === "hidden"
        ? "opacity-50 text-sm"
        : "";

  return (
    <div className={`relative flex gap-3 ${importanceClass}`}>
      {/* Left icon + vertical connector */}
      <div className="flex flex-col items-center">
        <div className="shrink-0 rounded-full p-1" style={iconColor ? { color: iconColor } : undefined}>
          {icon}
        </div>
        <div className="mt-1 flex-1 border-l-2 border-border" />
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start gap-2 pb-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <time className="shrink-0 text-xs text-muted">{timestamp}</time>
      </div>
    </div>
  );
}
