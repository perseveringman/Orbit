import { useState, type ReactElement } from 'react';
import { Chip, Button } from '@heroui/react';
import { Loader2, RotateCcw, Check, AlertCircle } from 'lucide-react';

type StepState = 'pending' | 'active' | 'done' | 'failed';

interface PipelineStep {
  id: string;
  label: string;
  state: StepState;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: 'discovered', label: '发现', state: 'done' },
  { id: 'fetched', label: '抓取', state: 'done' },
  { id: 'extracted', label: '提取', state: 'active' },
  { id: 'ready', label: '就绪', state: 'pending' },
];

function chipColor(state: StepState) {
  switch (state) {
    case 'done':
      return 'success' as const;
    case 'active':
      return 'accent' as const;
    case 'failed':
      return 'danger' as const;
    default:
      return 'default' as const;
  }
}

function StepIcon({ state }: { state: StepState }): ReactElement {
  switch (state) {
    case 'done':
      return <Check size={12} />;
    case 'active':
      return <Loader2 size={12} className="animate-spin" />;
    case 'failed':
      return <AlertCircle size={12} />;
    default:
      return <span className="inline-block w-3 h-3 rounded-full bg-current opacity-30" />;
  }
}

export function ContentPipelineStatus(): ReactElement {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);

  const handleRetry = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, state: 'active' as StepState } : s)),
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted mr-1">处理状态：</span>
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted text-xs">→</span>}
          <Chip size="sm" variant="soft" color={chipColor(step.state)}>
            <StepIcon state={step.state} /> {step.label}
          </Chip>
          {step.state === 'failed' && (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={() => handleRetry(step.id)}
              aria-label="重试"
            >
              <RotateCcw size={12} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
