import React from 'react';

interface NetworkTableFooterProps {
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export const NetworkTableFooter = ({
  isLoadingMore,
  hasMore,
  onLoadMore,
}: NetworkTableFooterProps) => {
  if (!hasMore && !isLoadingMore) return null;

  return (
    <>
      {isLoadingMore && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '12px',
          }}
        >
          Loading more networks...
        </div>
      )}
      {hasMore && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid rgba(71, 85, 105, 0.2)',
            background: 'rgba(15, 23, 42, 0.65)',
            textAlign: 'center',
          }}
        >
          <button
            onClick={() => !isLoadingMore && onLoadMore()}
            disabled={isLoadingMore}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#e2e8f0',
              borderRadius: '6px',
              cursor: isLoadingMore ? 'not-allowed' : 'pointer',
              opacity: isLoadingMore ? 0.6 : 1,
            }}
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
          {isLoadingMore && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
              Fetching more rows…
            </div>
          )}
        </div>
      )}
    </>
  );
};
