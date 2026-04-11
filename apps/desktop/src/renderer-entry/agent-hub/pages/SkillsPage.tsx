import { type ReactElement } from 'react';
import { Card, Chip } from '@heroui/react';
import { DOMAIN_AGENT_CONFIGS } from '@orbit/agent-core';

const DOMAIN_META: Record<string, { icon: string; color: 'accent' | 'success' | 'warning' | 'danger' | 'default' }> = {
  planning: { icon: '📋', color: 'accent' },
  reading: { icon: '📖', color: 'success' },
  research: { icon: '🔬', color: 'accent' },
  writing: { icon: '✍️', color: 'warning' },
  review: { icon: '🔍', color: 'default' },
  graph: { icon: '🕸️', color: 'danger' },
  ops: { icon: '⚙️', color: 'default' },
};

export function SkillsPage(): ReactElement {
  const configs = Object.entries(DOMAIN_AGENT_CONFIGS);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">技能</h1>
        <p className="text-sm text-default-500">
          {configs.length} 个 Domain Agent 配置 · 每个 Agent 有独立的系统提示词、能力范围和安全策略
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {configs.map(([domain, config]) => {
          const meta = DOMAIN_META[domain] ?? { icon: '🤖', color: 'default' as const };
          return (
            <Card key={domain} className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold capitalize">{domain}</span>
                    <Chip size="sm" color={meta.color} variant="soft">
                      Agent
                    </Chip>
                    <Chip size="sm" variant="tertiary">
                      最多 {config.maxIterations} 轮迭代
                    </Chip>
                  </div>

                  {/* System prompt */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-default-500">
                      系统提示词
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-y-auto rounded bg-default-100 p-3 text-xs leading-relaxed">
                      {config.systemPrompt}
                    </pre>
                  </details>

                  {/* Capabilities */}
                  <div className="mt-3 flex flex-wrap gap-4">
                    {config.allowedCapabilities.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-success-600">✅ 允许的能力</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {config.allowedCapabilities.map((cap) => (
                            <Chip key={cap} size="sm" color="success" variant="soft">{cap}</Chip>
                          ))}
                        </div>
                      </div>
                    )}
                    {config.blockedCapabilities.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-danger-600">🚫 禁止的能力</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {config.blockedCapabilities.map((cap) => (
                            <Chip key={cap} size="sm" color="danger" variant="soft">{cap}</Chip>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
