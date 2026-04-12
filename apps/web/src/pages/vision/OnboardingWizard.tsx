import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button, Card } from '@heroui/react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface Step {
  id: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: '定位说明',
    description: '愿景是对未来的清晰描绘，帮助你在日常决策中保持方向感。它不是具体的目标，而是你想成为什么样的人、过什么样的生活。',
  },
  {
    id: 2,
    title: '愿景书写',
    description: '用自己的话写下你的愿景。不必完美，只需真实。可以是一句话，也可以是几段文字。',
  },
  {
    id: 3,
    title: 'Agent 整理',
    description: 'Orbit Agent 会帮你整理和润色，让表达更清晰。',
  },
  {
    id: 4,
    title: '确认',
    description: '查看并确认整理后的愿景。你可以继续修改，或者接受建议。',
  },
  {
    id: 5,
    title: '提醒姿态',
    description: '选择愿景的提醒方式，帮助你在日常中不忘初心。',
  },
  {
    id: 6,
    title: '落地承接',
    description: '愿景已创建！你可以随时回顾和更新它。接下来，考虑创建一些 Directives 来指导行动。',
  },
];

const reminderOptions = [
  { value: 'gentle', label: '温和提醒', description: '偶尔在合适的时候提醒' },
  { value: 'persistent', label: '持续提醒', description: '定期提醒，帮助保持专注' },
  { value: 'none', label: '无提醒', description: '不主动提醒，自己查看' },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps): ReactElement {
  const [currentStep, setCurrentStep] = useState(1);
  const [visionText, setVisionText] = useState('');
  const [refinedText, setRefinedText] = useState('');
  const [reminderMode, setReminderMode] = useState('gentle');

  const handleNext = () => {
    if (currentStep === 2) {
      setRefinedText(`我希望${visionText}，在未来的日子里持续成长和进步。`);
    }
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground">{steps[0].description}</p>
            <div className="mt-4 p-4 bg-accent-soft rounded-lg">
              <p className="text-sm text-foreground m-0">
                <strong>示例：</strong>"成为一个对技术有深入理解、能够帮助他人成长的开发者。"
              </p>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-muted text-sm">{steps[1].description}</p>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="在此书写你的愿景..."
              className="w-full h-48 p-4 bg-surface border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-muted text-sm">{steps[2].description}</p>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
            <p className="text-center text-muted text-sm">Agent 正在整理中...</p>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-muted text-sm">{steps[3].description}</p>
            <div className="p-4 bg-surface border border-border rounded-lg">
              <p className="text-foreground whitespace-pre-wrap">{refinedText}</p>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-muted text-sm">{steps[4].description}</p>
            <div className="space-y-3">
              {reminderOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => setReminderMode(option.value)}
                  className="cursor-pointer"
                >
                <Card
                  className={`${
                    reminderMode === option.value
                      ? 'border-2 border-accent bg-accent-soft'
                      : 'border border-border'
                  }`}
                >
                  <Card.Content className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          reminderMode === option.value
                            ? 'border-accent bg-accent'
                            : 'border-border'
                        }`}
                      >
                        {reminderMode === option.value && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{option.label}</div>
                        <div className="text-sm text-muted">{option.description}</div>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Check size={32} className="text-success" />
              </div>
            </div>
            <p className="text-foreground">{steps[5].description}</p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-center py-8 border-b border-border">
        <div className="flex gap-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                step.id === currentStep
                  ? 'bg-accent'
                  : step.id < currentStep
                  ? 'bg-success'
                  : 'bg-surface border border-border'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{steps[currentStep - 1].title}</h2>
          </div>

          <div className="min-h-[300px]">{renderStepContent()}</div>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="secondary"
              onPress={handleBack}
              isDisabled={currentStep === 1}
            >
              <ArrowLeft size={18} />
              上一步
            </Button>

            <Button
              variant="primary"
              onPress={handleNext}
            >
              {currentStep === 6 ? '完成' : '下一步'}
              {currentStep === 6 ? <Check size={18} /> : <ArrowRight size={18} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
