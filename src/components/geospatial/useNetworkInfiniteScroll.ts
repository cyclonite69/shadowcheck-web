import { useEffect, useLayoutEffect, useRef } from 'react';
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
  const savedScrollTop = useRef<number>(0);
  const isLoadingMoreRef = useRef(false);

  // Preserve scroll position during load more
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isLoadingMoreRef.current && !isLoadingMore) {
      // Restore scroll position after new content is loaded
      container.scrollTop = savedScrollTop.current;
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingMore, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMore || isLoadingMore) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          // Save scroll position before triggering load more
          savedScrollTop.current = scrollTop;
          isLoadingMoreRef.current = true;
          onLoadMore();
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
