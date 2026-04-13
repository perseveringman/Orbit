import { type ReactElement } from 'react';
import { Card, Chip, Button, Separator } from '@heroui/react';
import { Bot, Check, X } from 'lucide-react';
import type { InboxItem } from './mock-data';

interface InboxDetailAgentProps {
  item: InboxItem;
}

export function InboxDetailAgent({ item }: InboxDetailAgentProps): ReactElement {
  const conversation = item.agentConversation ?? [];
  const actions = item.pendingActions ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Bot size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {item.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {item.agentName && (
                <Chip variant="soft" size="sm">
                  {item.agentName}
                </Chip>
              )}
              {item.agentAction && (
                <span className="text-xs text-muted">{item.agentAction}</span>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Conversation thread */}
        <div className="space-y-4">
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-accent text-white'
                    : 'bg-surface-secondary text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{msg.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    msg.role === 'user' ? 'text-white/70' : 'text-muted'
                  }`}
                >
                  {new Date(msg.time).toLocaleString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pending actions */}
        {actions.length > 0 && (
          <>
            <Separator className="my-6" />
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                待审批操作
              </h3>
              <div className="space-y-3">
                {actions.map((action) => (
                  <Card key={action.id}>
                    <Card.Content>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {action.label}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {action.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="primary" size="sm" onPress={() => {}}>
                            <Check size={14} /> 批准
                          </Button>
                          <Button variant="secondary" size="sm" onPress={() => {}}>
                            <X size={14} /> 拒绝
                          </Button>
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
