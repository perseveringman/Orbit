import { useState, type ReactElement } from 'react';

export type ReaderContentType = 'article' | 'podcast' | 'video' | 'book';

export interface ReaderRoute {
  type: ReaderContentType;
  id: string;
}

interface ReaderRouterProps {
  children: (props: {
    currentRoute: ReaderRoute | null;
    navigate: (route: ReaderRoute | null) => void;
    contentType: ReaderContentType | 'all';
    setContentType: (type: ReaderContentType | 'all') => void;
  }) => ReactElement;
}

export function ReaderRouter({ children }: ReaderRouterProps): ReactElement {
  const [currentRoute, setCurrentRoute] = useState<ReaderRoute | null>(null);
  const [contentType, setContentType] = useState<ReaderContentType | 'all'>('all');

  return children({
    currentRoute,
    navigate: setCurrentRoute,
    contentType,
    setContentType,
  });
}
