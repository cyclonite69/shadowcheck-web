import { useEffect, useState, useRef, useMemo, KeyboardEvent } from 'react';
import { networkApi, NetworkMediaItem } from '../../../api/networkApi';

interface MatchedMediaCarouselPopupProps {
  memberBssids: string[];
  mediaIds: number[];
  markerLocationSource: 'observation' | 'exif' | 'network' | string | null;
  observationId: number | null;
  captureLat: number | null;
  captureLon: number | null;
  observationLat: number | null;
  observationLon: number | null;
  networkLat: number | null;
  networkLon: number | null;
  onClose?: () => void;
}

export const MatchedMediaCarouselPopup = ({
  memberBssids,
  mediaIds,
  markerLocationSource,
  captureLat,
  captureLon,
  observationLat,
  observationLon,
  onClose,
}: MatchedMediaCarouselPopupProps) => {
  const [items, setItems] = useState<NetworkMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse member BSSIDs (in case passed as JSON string from Mapbox properties)
  const resolvedBssids = useMemo(() => {
    if (!memberBssids) {
      return [];
    }
    if (Array.isArray(memberBssids)) {
      return memberBssids;
    }
    try {
      const parsed = JSON.parse(memberBssids);
      return Array.isArray(parsed) ? parsed : [String(memberBssids)];
    } catch {
      return [String(memberBssids)];
    }
  }, [memberBssids]);

  // Parse media IDs
  const resolvedMediaIds = useMemo(() => {
    if (!mediaIds) {
      return [];
    }
    if (Array.isArray(mediaIds)) {
      return mediaIds;
    }
    try {
      const parsed = JSON.parse(mediaIds);
      return Array.isArray(parsed) ? parsed.map(Number) : [Number(mediaIds)];
    } catch {
      return [Number(mediaIds)];
    }
  }, [mediaIds]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadAllMedia = async () => {
      try {
        if (!resolvedBssids || resolvedBssids.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // Fetch media for every member BSSID in parallel
        const responses = await Promise.all(
          resolvedBssids.map((bssid) => networkApi.getNetworkMedia(bssid))
        );

        if (!active) {
          return;
        }

        // Merge results and deduplicate by media ID
        const mergedMap = new Map<number, NetworkMediaItem>();
        for (const list of responses) {
          for (const item of list) {
            if (item && item.id) {
              mergedMap.set(item.id, item);
            }
          }
        }
        const mergedList = Array.from(mergedMap.values());

        // Sort deterministically:
        // 1. Items in resolvedMediaIds (following their order in resolvedMediaIds)
        // 2. Capture date / created date / ID fallback
        mergedList.sort((a, b) => {
          const idxA = resolvedMediaIds.indexOf(a.id);
          const idxB = resolvedMediaIds.indexOf(b.id);

          const hasA = idxA !== -1;
          const hasB = idxB !== -1;

          if (hasA && hasB) {
            return idxA - idxB;
          }
          if (hasA) {
            return -1;
          }
          if (hasB) {
            return 1;
          }

          // Fallback sorting: EXIF date, then creation date, then ID
          const timeA = new Date(a.exif_captured_at || a.created_at).getTime();
          const timeB = new Date(b.exif_captured_at || b.created_at).getTime();
          if (timeA !== timeB) {
            return timeB - timeA;
          } // Descending order (newest first)

          return b.id - a.id;
        });

        setItems(mergedList);
        setActiveIndex(0);
      } catch (err) {
        if (active) {
          console.error('Failed to load component media items', err);
          setError('Failed to load media.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAllMedia();

    return () => {
      active = false;
    };
  }, [resolvedBssids, resolvedMediaIds]);

  // Set focus on container to capture keyboard inputs
  useEffect(() => {
    if (!loading && items.length > 0 && containerRef.current) {
      containerRef.current.focus();
    }
  }, [loading, items]);

  const activeItem: NetworkMediaItem | undefined = items[activeIndex];

  const handleNext = () => {
    if (items.length <= 1) {
      return;
    }
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    if (items.length <= 1) {
      return;
    }
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'Enter' && activeItem) {
      window.open(activeItem.inline_url, '_blank');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: '320px',
          height: '280px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#94a3b8',
          fontFamily: 'monospace',
          borderRadius: '9px',
          border: '1px solid #1e293b',
        }}
      >
        <span>Loading media carousel...</span>
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div
        style={{
          width: '320px',
          height: '180px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: error ? '#f87171' : '#64748b',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '16px',
          borderRadius: '9px',
          border: '1px solid #1e293b',
          textAlign: 'center',
        }}
      >
        <span>{error || 'No media items available for component.'}</span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              marginTop: '12px',
              padding: '4px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  // Calculate distance details if coordinates are present
  let distanceText: string | null = null;
  if (
    markerLocationSource === 'observation' &&
    captureLat !== null &&
    captureLon !== null &&
    observationLat !== null &&
    observationLon !== null
  ) {
    const dist = calculateDistance(captureLat, captureLon, observationLat, observationLon);
    distanceText = `Captured ${dist.toFixed(2)}m from observation point`;
  }

  const isNetworkFallback = markerLocationSource === 'network';

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: '340px',
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: '9px',
        border: '1px solid #334155',
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: '11px',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Header Warning for Fallback */}
      {isNetworkFallback && (
        <div
          style={{
            background: 'rgba(217, 119, 6, 0.2)',
            color: '#fbbf24',
            padding: '6px 10px',
            borderBottom: '1px solid rgba(217, 119, 6, 0.4)',
            fontSize: '10px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>⚠️ LOCATION FALLBACK: Centroid Estimate Only</span>
        </div>
      )}

      {/* Main Preview */}
      <div
        style={{
          position: 'relative',
          height: '180px',
          background: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #1e293b',
        }}
      >
        {activeItem.mime_type?.startsWith('image/') ? (
          <img
            src={activeItem.inline_url}
            alt={`Evidence for BSSID ${activeItem.source_bssid} - ${activeItem.filename ?? 'unknown'}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              cursor: 'pointer',
            }}
            onClick={() => window.open(activeItem.inline_url, '_blank')}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const fallback = document.createElement('div');
                fallback.innerText = '⚠️ Image unavailable';
                fallback.style.color = '#ef4444';
                fallback.style.fontFamily = 'monospace';
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div
            style={{
              fontSize: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              background: '#1e293b',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
            onClick={() => window.open(activeItem.inline_url, '_blank')}
          >
            🎬
          </div>
        )}

        {/* Carousel Prev/Next Buttons */}
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous image"
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 'bold',
                zIndex: 10,
              }}
            >
              &lt;
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next image"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 'bold',
                zIndex: 10,
              }}
            >
              &gt;
            </button>
          </>
        )}

        {/* Carousel Indicators Counter */}
        {items.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              background: 'rgba(15, 23, 42, 0.75)',
              padding: '2px 6px',
              borderRadius: '4px',
              color: '#94a3b8',
              fontSize: '10px',
              border: '1px solid #334155',
            }}
          >
            {activeIndex + 1} / {items.length}
          </div>
        )}
      </div>

      {/* Metadata & Provenance Section */}
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontWeight: 'bold',
              color: '#38bdf8',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
            }}
            title={activeItem.filename ?? 'unknown'}
          >
            {activeItem.filename ?? 'unknown'}
          </span>
          <span style={{ color: '#64748b' }}>ID: #{activeItem.id}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div>
            <span style={{ color: '#64748b' }}>BSSID: </span>
            <span style={{ color: '#e2e8f0' }}>{activeItem.source_bssid}</span>
            {activeItem.is_direct ? (
              <span
                style={{
                  marginLeft: '6px',
                  background: 'rgba(74, 222, 128, 0.1)',
                  color: '#4ade80',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '9px',
                }}
              >
                direct
              </span>
            ) : (
              <span
                style={{
                  marginLeft: '6px',
                  background: 'rgba(167, 139, 250, 0.1)',
                  color: '#a78bfa',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '9px',
                }}
              >
                component sibling
              </span>
            )}
          </div>

          {activeItem.observation_id !== null && activeItem.observation_id !== undefined && (
            <div>
              <span style={{ color: '#64748b' }}>Obs Anchor: </span>
              <a
                href={`#obs-${activeItem.observation_id}`}
                style={{ color: '#06b6d4', textDecoration: 'underline' }}
                onClick={(e) => e.stopPropagation()}
              >
                obs #{activeItem.observation_id}
              </a>
            </div>
          )}

          {(activeItem.exif_captured_at ?? activeItem.created_at) && (
            <div>
              <span style={{ color: '#64748b' }}>Captured: </span>
              <span style={{ color: '#cbd5e1' }}>
                {new Date(activeItem.exif_captured_at ?? activeItem.created_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Provenance Badge */}
        <div
          style={{
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #1e293b',
            paddingTop: '6px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {markerLocationSource === 'observation' && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                }}
              >
                OBSERVATION LOCATION MATCH
              </span>
            )}
            {markerLocationSource === 'exif' && (
              <span
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                }}
              >
                EXIF CAPTURE LOCATION
              </span>
            )}
            {isNetworkFallback && (
              <span
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                }}
              >
                NETWORK ESTIMATE FALLBACK
              </span>
            )}
          </div>
        </div>

        {distanceText && (
          <div style={{ fontSize: '9px', color: '#10b981', fontStyle: 'italic', marginTop: '2px' }}>
            {distanceText}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div
          style={{
            background: '#020617',
            padding: '8px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
          }}
        >
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={item.id}
                onClick={() => setActiveIndex(index)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isActive ? '2px solid #14b8a6' : '1px solid #334155',
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.6,
                  transition: 'opacity 0.2s, border-color 0.2s',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.mime_type?.startsWith('image/') ? (
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '14px' }}>🎬</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Simple spherical distance helper in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
