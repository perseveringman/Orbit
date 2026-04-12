import { Button } from "@heroui/react";

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  severity: "warning" | "danger";
  affectedItems?: string[];
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  severity,
  affectedItems,
  confirmLabel = "确认",
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const borderColor = severity === "danger" ? "border-danger" : "border-warning";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`w-full max-w-md rounded-xl border-2 ${borderColor} bg-background p-6 shadow-xl`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <h2 id="confirm-title" className="text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 text-sm text-muted">
          {description}
        </p>

        {affectedItems && affectedItems.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
            {affectedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onPress={onCancel}>
            取消
          </Button>
          <Button variant={severity === "danger" ? "danger" : "secondary"} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
