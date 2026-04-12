import { Chip } from "@heroui/react";
import { Lock, Shield } from "lucide-react";

export interface PrivacyChipProps {
  level: "normal" | "sensitive" | "sealed";
}

export function PrivacyChip({ level }: PrivacyChipProps) {
  if (level === "normal") return null;

  if (level === "sensitive") {
    return (
      <Chip variant="soft" color="warning">
        <Shield size={14} />
        敏感
      </Chip>
    );
  }

  return (
    <Chip variant="soft" color="danger">
      <Lock size={14} />
      密封
    </Chip>
  );
}
