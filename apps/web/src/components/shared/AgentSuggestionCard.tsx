import { useState } from "react";

import { Button, Card, Label, ProgressBar } from "@heroui/react";
import { Bot, ChevronDown } from "lucide-react";

export interface AgentSuggestionCardProps {
  title: string;
  description: string;
  reasoning?: string;
  confidence?: number;
  onAccept: () => void;
  onReject: () => void;
}

export function AgentSuggestionCard({
  title,
  description,
  reasoning,
  confidence,
  onAccept,
  onReject,
}: AgentSuggestionCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2 text-accent">
          <Bot size={18} />
          <Card.Title>{title}</Card.Title>
        </div>
        <Card.Description>{description}</Card.Description>
      </Card.Header>

      <Card.Content>
        {reasoning && (
          <div className="mb-3">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              onClick={() => setShowReasoning((v) => !v)}
            >
              <ChevronDown
                size={14}
                className={`transition-transform ${showReasoning ? "rotate-180" : ""}`}
              />
              推理过程
            </button>
            {showReasoning && (
              <p className="mt-2 rounded-md bg-surface-secondary p-3 text-xs text-muted">
                {reasoning}
              </p>
            )}
          </div>
        )}

        {confidence != null && (
          <ProgressBar aria-label="置信度" className="w-full" value={confidence}>
            <Label className="text-xs text-muted">置信度</Label>
            <ProgressBar.Output className="text-xs text-muted" />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
      </Card.Content>

      <Card.Footer className="flex justify-end gap-2">
        <Button variant="ghost" onPress={onReject}>
          拒绝
        </Button>
        <Button onPress={onAccept}>
          接受
        </Button>
      </Card.Footer>
    </Card>
  );
}
