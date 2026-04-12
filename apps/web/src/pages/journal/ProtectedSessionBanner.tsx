import { useState, useEffect, type ReactElement } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@heroui/react';

interface ProtectedSessionBannerProps {
  active: boolean;
  startedAt: Date;
  onEnd: () => void;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ProtectedSessionBanner({
  active,
  startedAt,
  onEnd,
}: ProtectedSessionBannerProps): ReactElement | null {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;
    const update = () => setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [active, startedAt]);

  if (!active) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-warning/10 border border-warning/30">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-warning" />
        <span className="text-sm font-medium text-warning">
          保护模式已开启 — 活动不会被自动记录
        </span>
        <span className="text-xs text-muted font-mono">{formatElapsed(elapsed)}</span>
      </div>
      <Button variant="secondary" size="sm" onPress={onEnd}>
        结束保护模式
      </Button>
    </div>
  );
}
