import { useEffect, useState } from 'react';
import { networkApi, NetworkMediaItem } from '../../../api/networkApi';

/**
 * NetworkMediaPanel — Surface app.network_media for a selected BSSID.
 *
 * Current placement: NetworkTagMenu context-menu portal, triggered when the user right-clicks a network/BSSID.
 * Activation: User right-clicks network → contextMenu appears → media panel renders in visible portal.
 *
 * Scope: Direct media is immediately visible. Component media surfaces after migration _055 is applied.
 *
 * Future: Network Observations Detail architecture (separate feature) will provide persistent
 * selected-network context with media, observations, notes, and evidence workflow. This panel is
 * a minimal v1 that does not redesign that flow.
 */

interface NetworkMediaPanelProps {
  bssid: string | null;
}

export const NetworkMediaPanel = ({ bssid }: NetworkMediaPanelProps) => {
  const [media, setMedia] = useState<NetworkMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bssid) {
      setMedia([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    networkApi
      .getNetworkMedia(bssid)
      .then((rows) => {
        if (!cancelled) {
          setMedia(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load media.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bssid]);

  if (!bssid) {
    return null;
  }

  return (
    <div style={{ marginTop: '12px', paddingBottom: '12px' }}>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#94a3b8',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        📸 Related Media
      </div>

      {loading && (
        <div style={{ fontSize: '12px', color: '#64748b', padding: '8px 0' }}>Loading…</div>
      )}

      {error && <div style={{ fontSize: '12px', color: '#f87171', padding: '4px 0' }}>{error}</div>}

      {!loading && !error && media.length === 0 && (
        <div style={{ fontSize: '12px', color: '#64748b', padding: '4px 0' }}>
          No related media.
        </div>
      )}

      {!loading && !error && !Array.isArray(media) && (
        <div style={{ fontSize: '12px', color: '#fca5a5', padding: '4px 0' }}>
          ERROR: media is not an array.
        </div>
      )}

      {!loading && media.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {media.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '8px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                cursor: 'pointer',
              }}
              onClick={() => window.open(item.inline_url, '_blank')}
            >
              {/* Thumbnail */}
              {item.mime_type?.startsWith('image/') ? (
                <img
                  src={item.thumbnail_url}
                  alt={item.filename ?? 'media'}
                  style={{
                    width: 52,
                    height: 52,
                    objectFit: 'cover',
                    borderRadius: 4,
                    flexShrink: 0,
                    border: '1px solid #475569',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    background: '#334155',
                    borderRadius: 4,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  🎬
                </div>
              )}

              {/* Metadata */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#e2e8f0',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.filename ?? 'unknown'}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: item.is_direct
                        ? 'rgba(74,222,128,0.12)'
                        : 'rgba(167,139,250,0.12)',
                      color: item.is_direct ? '#4ade80' : '#a78bfa',
                      fontWeight: 600,
                    }}
                  >
                    {item.is_direct ? 'direct' : 'via component'}
                  </span>
                  {!item.is_direct && (
                    <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                      {item.source_bssid}
                    </span>
                  )}
                </div>
                {item.observation_id !== null && item.observation_id !== undefined && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    obs #{item.observation_id}
                  </div>
                )}
                {(item.exif_captured_at ?? item.created_at) && (
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                    {new Date(item.exif_captured_at ?? item.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
