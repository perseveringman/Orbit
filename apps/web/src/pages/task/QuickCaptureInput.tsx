import { useState, type ReactElement } from 'react';
import { Card, Chip, Button, Spinner } from '@heroui/react';
import { Check, AlertTriangle, Pencil, X } from 'lucide-react';
import type { StatusColor } from './mock-data';

interface ParseResult {
  suggestedTitle: string;
  suggestedProject: string | null;
  subtasks: string[];
  confidence: number;
}

interface IntentParsePreviewProps {
  result: ParseResult;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function IntentParsePreview({
  result,
  onConfirm,
  onEdit,
  onCancel,
}: IntentParsePreviewProps): ReactElement {
  const isHigh = result.confidence > 0.8;
  const confidenceColor: StatusColor = isHigh ? 'success' : 'warning';
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <Card className="border border-border">
      <Card.Header>
        <div className="flex items-center gap-2">
          {isHigh ? (
            <Check size={16} className="text-success" />
          ) : (
            <AlertTriangle size={16} className="text-warning" />
          )}
          <span className="text-sm font-medium">
            {isHigh ? '意图解析完成' : '意图解析 — 需确认'}
          </span>
          <Chip variant="soft" color={confidenceColor} size="sm">
            置信度 {confidencePct}%
          </Chip>
        </div>
      </Card.Header>
      <Card.Content>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted">建议标题</span>
            <p className="text-sm font-medium text-foreground">
              {result.suggestedTitle}
            </p>
          </div>
          {result.suggestedProject && (
            <div>
              <span className="text-xs text-muted">建议项目</span>
              <p className="text-sm text-foreground">
                {result.suggestedProject}
              </p>
            </div>
          )}
          {result.subtasks.length > 0 && (
            <div>
              <span className="text-xs text-muted">子任务</span>
              <ul className="mt-1 space-y-1">
                {result.subtasks.map((st, i) => (
                  <li key={i} className="text-sm text-foreground flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted inline-block" />
                    {st}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Confidence meter */}
          <div>
            <span className="text-xs text-muted">置信度</span>
            <div className="mt-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isHigh ? 'bg-success' : 'bg-warning'}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>
      </Card.Content>
      <Card.Footer>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onPress={onConfirm}>
            <Check size={14} /> 确认创建
          </Button>
          <Button variant="secondary" size="sm" onPress={onEdit}>
            <Pencil size={14} /> 编辑
          </Button>
          <Button variant="ghost" size="sm" onPress={onCancel}>
            <X size={14} /> 取消
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
}

// ─── QuickCaptureInput ───────────────────────────────────────────────

export function QuickCaptureInput(): ReactElement {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const handleSubmit = () => {
    if (!value.trim()) return;
    setLoading(true);
    // Simulate agent parse
    setTimeout(() => {
      setParseResult({
        suggestedTitle: value.trim(),
        suggestedProject: 'Orbit MVP 发布',
        subtasks: ['明确目标范围', '拆分子步骤', '设定完成定义'],
        confidence: 0.82,
      });
      setLoading(false);
    }, 1200);
  };

  const handleConfirm = () => {
    setParseResult(null);
    setValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="输入你想做的事..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <Button
          variant="primary"
          size="sm"
          onPress={handleSubmit}
          isDisabled={!value.trim() || loading}
        >
          {loading ? <Spinner size="sm" /> : '捕获'}
        </Button>
      </div>
      {parseResult && (
        <IntentParsePreview
          result={parseResult}
          onConfirm={handleConfirm}
          onEdit={() => setParseResult(null)}
          onCancel={() => {
            setParseResult(null);
            setValue('');
          }}
        />
      )}
    </div>
  );
}
