import type { ReactElement } from 'react';
import { Button, Card } from '@heroui/react';
import { Compass, X } from 'lucide-react';

interface ReminderCardProps {
  visionTitle: string;
  visionExcerpt: string;
  onDismiss: () => void;
}

export function ReminderCard({ visionTitle, visionExcerpt, onDismiss }: ReminderCardProps): ReactElement {
  return (
    <div className="animate-slide-down">
      <Card className="bg-accent-soft border border-accent/30">
        <Card.Content className="p-4">
          <div className="flex items-start gap-4">
            <div className="mt-1 p-2 bg-accent/20 rounded-lg">
              <Compass size={24} className="text-accent" />
            </div>
            
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <span>温和提醒</span>
              </h3>
              <div>
                <p className="text-sm font-medium text-foreground">{visionTitle}</p>
                <p className="text-sm text-muted mt-1 line-clamp-2">{visionExcerpt}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={onDismiss}
              className="text-muted hover:text-foreground"
            >
              <X size={18} />
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
