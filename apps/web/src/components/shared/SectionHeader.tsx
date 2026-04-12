export interface SectionHeaderProps {
  label: string;
}

export function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="px-3 pt-4 pb-1 text-xs font-semibold text-muted uppercase tracking-wider">
      {label}
    </div>
  );
}
