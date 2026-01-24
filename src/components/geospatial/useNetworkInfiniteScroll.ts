import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

type NetworkInfiniteScrollProps = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export const useNetworkInfiniteScroll = ({
  containerRef,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: NetworkInfiniteScrollProps) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMore || isLoadingMore) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          const currentScrollTop = scrollTop;
          onLoadMore();

          // Restore scroll position after a brief delay
          setTimeout(() => {
            if (container.scrollTop !== currentScrollTop) {
              container.scrollTop = currentScrollTop;
            }
          }, 50);
        }
      }, 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [containerRef, hasMore, isLoadingMore, onLoadMore]);
};
