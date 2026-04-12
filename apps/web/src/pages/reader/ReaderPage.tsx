import { useState, type ReactElement } from 'react';
import { Button, Separator } from '@heroui/react';
import { Plus, BookOpenText } from 'lucide-react';
import type { Article } from './mock-data';
import { MOCK_ARTICLES, MOCK_PODCASTS, MOCK_VIDEOS, MOCK_BOOKS } from './mock-data';
import { ReaderView } from './ReaderView';
import { PodcastPlayerView } from './PodcastPlayerView';
import { VideoPlayerView } from './VideoPlayerView';
import { BookReaderView } from './BookReaderView';
import { SubscriptionPanel } from './SubscriptionPanel';
import { ReaderRouter, type ReaderRoute } from './ReaderRouter';
import { ContentListPage } from './ContentListPage';
import { AddContentModal } from './AddContentModal';

type ViewMode = 'library' | 'reading';

function renderContentView(route: ReaderRoute, onBack: () => void): ReactElement | null {
  switch (route.type) {
    case 'podcast': {
      const episode = MOCK_PODCASTS.find((p) => p.id === route.id || `c-${p.id}` === route.id);
      if (episode) return <PodcastPlayerView episode={episode} onBack={onBack} />;
      break;
    }
    case 'video': {
      const video = MOCK_VIDEOS.find((v) => v.id === route.id || `c-${v.id}` === route.id);
      if (video) return <VideoPlayerView video={video} onBack={onBack} />;
      break;
    }
    case 'book': {
      const book = MOCK_BOOKS.find((b) => b.id === route.id || `c-${b.id}` === route.id);
      if (book) return <BookReaderView book={book} onBack={onBack} />;
      break;
    }
  }
  return null;
}

export function ReaderPage(): ReactElement {
  const [view, setView] = useState<ViewMode>('library');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    setView('reading');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setSelectedArticle(null);
  };

  const handleAddContent = (url: string) => {
    console.log('[ReaderPage] add content:', url);
  };

  if (view === 'reading' && selectedArticle) {
    return <ReaderView article={selectedArticle} onBack={handleBackToLibrary} />;
  }

  return (
    <ReaderRouter>
      {({ currentRoute, navigate, contentType, setContentType }) => {
        // Render content-specific views when a non-article route is active
        if (currentRoute) {
          const contentView = renderContentView(currentRoute, () => navigate(null));
          if (contentView) return contentView;
        }

        return (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpenText size={20} className="text-accent" />
                <h1 className="text-lg font-semibold text-foreground">阅读</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setShowSubscriptions(!showSubscriptions)}
                >
                  {showSubscriptions ? '隐藏订阅' : '管理订阅'}
                </Button>
                <Button variant="primary" size="sm" onPress={() => setShowAddModal(true)}>
                  <Plus size={14} /> 添加
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <ContentListPage
                  contentType={contentType}
                  onContentTypeChange={setContentType}
                  onSelectItem={(type, id) => {
                    // For articles, use the existing ReaderView
                    if (type === 'article') {
                      const article = MOCK_ARTICLES.find((a) => a.id === id || `c-${a.id}` === id);
                      if (article) {
                        handleSelectArticle(article);
                        return;
                      }
                    }
                    navigate({ type, id });
                  }}
                />
              </div>

              {showSubscriptions && (
                <>
                  <Separator orientation="vertical" />
                  <aside className="w-80 border-l border-border bg-surface overflow-y-auto shrink-0">
                    <SubscriptionPanel />
                  </aside>
                </>
              )}
            </div>

            <AddContentModal
              isOpen={showAddModal}
              onClose={() => setShowAddModal(false)}
              onSubmit={handleAddContent}
            />
          </div>
        );
      }}
    </ReaderRouter>
  );
}
