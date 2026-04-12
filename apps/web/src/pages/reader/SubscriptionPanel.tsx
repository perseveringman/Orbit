import { useState, type ReactElement } from 'react';
import { Button, Card, Chip, Input, Separator } from '@heroui/react';
import { Plus, Search, Pause, Play, Trash2, Rss } from 'lucide-react';
import { MOCK_SUBSCRIPTIONS } from './mock-data';
import type { Subscription } from './mock-data';

interface DiscoveryResult {
  title: string;
  url: string;
  type: string;
}

export function SubscriptionPanel(): ReactElement {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleDiscover = () => {
    if (!discoverUrl.trim()) return;
    setIsDiscovering(true);
    // Simulate discovery
    setTimeout(() => {
      setDiscoveryResults([
        { title: `${discoverUrl} — 主 RSS 源`, url: `${discoverUrl}/feed.xml`, type: 'RSS' },
        { title: `${discoverUrl} — Atom 源`, url: `${discoverUrl}/atom.xml`, type: 'Atom' },
      ]);
      setIsDiscovering(false);
    }, 800);
  };

  const handleToggle = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'active' ? ('paused' as const) : ('active' as const) }
          : s,
      ),
    );
  };

  const handleUnsubscribe = (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubscribe = (result: DiscoveryResult) => {
    console.log(`[SubscriptionPanel] subscribe: ${result.url}`);
    setDiscoveryResults((prev) => prev.filter((r) => r.url !== result.url));
  };

  const kindColor = (kind: Subscription['kind']) => {
    switch (kind) {
      case 'rss':
        return 'accent' as const;
      case 'site-watch':
        return 'warning' as const;
      case 'channel':
        return 'success' as const;
    }
  };

  const kindLabel = (kind: Subscription['kind']) => {
    switch (kind) {
      case 'rss':
        return 'RSS';
      case 'site-watch':
        return '网站监测';
      case 'channel':
        return '频道';
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Add source */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          <Plus size={14} className="inline" /> 添加源
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="输入 URL 发现 RSS 源…"
            value={discoverUrl}
            onChange={(e) => setDiscoverUrl(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button
            variant="primary"
            size="sm"
            onPress={handleDiscover}
            isDisabled={isDiscovering}
          >
            <Search size={14} /> 发现
          </Button>
        </div>

        {discoveryResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {discoveryResults.map((result) => (
              <div
                key={result.url}
                className="flex items-center justify-between p-2 bg-surface-secondary rounded-lg text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Rss size={14} className="text-accent shrink-0" />
                  <span className="truncate">{result.title}</span>
                  <Chip size="sm" variant="soft">{result.type}</Chip>
                </div>
                <Button variant="primary" size="sm" onPress={() => handleSubscribe(result)}>
                  订阅
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Subscription list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">订阅列表</h3>
        {subscriptions.map((sub) => (
          <Card key={sub.id}>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color={kindColor(sub.kind)}>
                  {kindLabel(sub.kind)}
                </Chip>
                <Chip
                  size="sm"
                  variant="soft"
                  color={sub.status === 'active' ? 'success' : 'default'}
                >
                  {sub.status === 'active' ? '运行中' : '已暂停'}
                </Chip>
              </div>
            </Card.Header>
            <Card.Title>{sub.title}</Card.Title>
            <Card.Description>
              {sub.fetchInterval} · {sub.articleCount} 篇文章
            </Card.Description>
            <Card.Footer>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => handleToggle(sub.id)}
                >
                  {sub.status === 'active' ? (
                    <><Pause size={14} /> 暂停</>
                  ) : (
                    <><Play size={14} /> 恢复</>
                  )}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onPress={() => handleUnsubscribe(sub.id)}
                >
                  <Trash2 size={14} /> 退订
                </Button>
              </div>
            </Card.Footer>
          </Card>
        ))}
      </div>
    </div>
  );
}
