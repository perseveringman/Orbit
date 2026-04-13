import { useState, type ReactElement } from 'react';
import { Button, Card, Chip, Input, Separator } from '@heroui/react';
import { Plus, Search, Pause, Play, Trash2, Rss } from 'lucide-react';
import { useSubscriptionList, type Subscription } from '../../data/use-subscriptions';
import { useSubscriptionMutations } from '../../data/use-subscription-mutations';

interface DiscoveryResult {
  title: string;
  url: string;
  type: string;
}

export function SubscriptionPanel(): ReactElement {
  const { subscriptions } = useSubscriptionList();
  const { createSubscription, pauseSubscription, resumeSubscription, deleteSubscription } = useSubscriptionMutations();
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleDiscover = () => {
    if (!discoverUrl.trim()) return;
    setIsDiscovering(true);
    setTimeout(() => {
      setDiscoveryResults([
        { title: `${discoverUrl} — 主 RSS 源`, url: `${discoverUrl}/feed.xml`, type: 'RSS' },
        { title: `${discoverUrl} — Atom 源`, url: `${discoverUrl}/atom.xml`, type: 'Atom' },
      ]);
      setIsDiscovering(false);
    }, 800);
  };

  const handleToggle = (sub: Subscription) => {
    if (sub.syncStatus === 'paused') {
      resumeSubscription(sub.id);
    } else {
      pauseSubscription(sub.id);
    }
  };

  const handleUnsubscribe = (id: string) => {
    deleteSubscription(id);
  };

  const handleSubscribe = (result: DiscoveryResult) => {
    createSubscription({
      title: result.title,
      endpointType: 'rss',
      url: result.url,
      feedUrl: result.url,
    });
    setDiscoveryResults((prev) => prev.filter((r) => r.url !== result.url));
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'rss': return 'accent' as const;
      case 'youtube': return 'danger' as const;
      case 'podcast': return 'success' as const;
      default: return 'warning' as const;
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
                <Chip size="sm" variant="soft" color={typeColor(sub.endpointType)}>
                  {sub.endpointType.toUpperCase()}
                </Chip>
                <Chip
                  size="sm"
                  variant="soft"
                  color={sub.syncStatus === 'paused' ? 'default' : 'success'}
                >
                  {sub.syncStatus === 'paused' ? '已暂停' : '运行中'}
                </Chip>
              </div>
            </Card.Header>
            <Card.Title>{sub.title}</Card.Title>
            <Card.Description>
              {sub.fetchIntervalMinutes}分钟/次 · {sub.totalItems} 篇文章
            </Card.Description>
            <Card.Footer>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => handleToggle(sub)}
                >
                  {sub.syncStatus !== 'paused' ? (
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
