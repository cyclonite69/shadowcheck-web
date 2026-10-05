import React, { useState } from 'react';

export const Film: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M7 3v18" />
    <path d="M3 7.5h4" />
    <path d="M3 12h18" />
    <path d="M3 16.5h4" />
    <path d="M17 3v18" />
    <path d="M17 7.5h4" />
    <path d="M17 16.5h4" />
  </svg>
);

export const AlertCircle: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export interface NetworkMediaViewerProps {
  mediaId?: number | string;
  src?: string;
  mediaType?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  className?: string;
  style?: React.CSSProperties;
  autoplay?: boolean;
  controls?: boolean;
  onLoadError?: (error: unknown) => void;
}

/**
 * Determines whether a media item is a video using authoritative metadata first,
 * falling back to filename extension only if metadata is missing.
 */
export function isVideoMedia(
  mediaType?: string | null,
  mimeType?: string | null,
  filename?: string | null
): boolean {
  if (mediaType === 'video') {
    return true;
  }
  if (typeof mimeType === 'string' && mimeType.startsWith('video/')) {
    return true;
  }
  if (mediaType === 'image') {
    return false;
  }
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return false;
  }
  if (filename) {
    return /\.(mp4|webm|mov|m4v|mkv)$/i.test(filename);
  }
  return false;
}

/**
 * Polymorphic viewer component that renders an HTML5 video player with byte-range
 * seeking support for video attachments, or an img tag for image attachments.
 */
export const NetworkMediaViewer: React.FC<NetworkMediaViewerProps> = ({
  mediaId,
  src,
  mediaType,
  mimeType,
  filename = 'media',
  className = 'max-h-[70vh] w-auto rounded object-contain',
  style,
  autoplay = false,
  controls = true,
  onLoadError,
}) => {
  const [loadError, setLoadError] = useState(false);
  const mediaUrl =
    src || (mediaId !== undefined ? `/api/admin/network-media/${mediaId}/inline` : '');
  const isVideo = isVideoMedia(mediaType, mimeType, filename);

  const handleError = (e: unknown) => {
    setLoadError(true);
    onLoadError?.(e);
  };

  if (!mediaUrl || loadError) {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded text-slate-400"
        style={style}
      >
        <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
        <span className="text-xs">Failed to load {filename || 'media'}</span>
      </div>
    );
  }

  if (isVideo) {
    const videoMime =
      typeof mimeType === 'string' && mimeType.startsWith('video/') ? mimeType : 'video/mp4';
    return (
      <video
        controls={controls}
        playsInline
        preload="metadata"
        autoPlay={autoplay}
        title={filename || undefined}
        className={className}
        style={style}
        onError={handleError}
      >
        <source src={mediaUrl} type={videoMime} />
        Your browser does not support HTML5 video playback.
      </video>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={filename || 'media'}
      className={className}
      style={style}
      onError={handleError}
      loading="lazy"
    />
  );
};

export interface NetworkMediaThumbnailItem {
  id?: number | string;
  thumbnail_url?: string;
  inline_url?: string;
  media_type?: string | null;
  mime_type?: string | null;
  filename?: string | null;
}

export interface NetworkMediaThumbnailProps {
  item: NetworkMediaThumbnailItem;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  alt?: string;
}

/**
 * Thumbnail / indicator tile representation for gallery or list contexts.
 * Since video thumbnail generation is bypassed for MP4s, displays an interactive
 * indicator tile with film icon and format tag instead of a broken image.
 */
export const NetworkMediaThumbnail: React.FC<NetworkMediaThumbnailProps> = ({
  item,
  className = 'w-16 h-16',
  style,
  onClick,
  alt,
}) => {
  const isVideo = isVideoMedia(item.media_type, item.mime_type, item.filename);
  const title = item.filename || 'media';

  if (isVideo) {
    return (
      <div
        onClick={onClick}
        title={title}
        className={`relative bg-slate-950 border border-slate-800 rounded flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500 transition group ${className}`}
        style={style}
      >
        <Film className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition" />
        <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold bg-slate-900/90 text-cyan-300 px-1 rounded border border-slate-800">
          MP4
        </span>
      </div>
    );
  }

  const thumbSrc =
    item.thumbnail_url ||
    (item.id !== undefined ? `/api/admin/network-media/${item.id}/inline?thumbnail=true` : '');

  return (
    <img
      src={thumbSrc}
      alt={alt || title}
      title={title}
      onClick={onClick}
      className={`object-cover rounded border border-slate-800 cursor-pointer hover:border-cyan-500 transition ${className}`}
      style={style}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.opacity = '0.5';
      }}
    />
  );
};
