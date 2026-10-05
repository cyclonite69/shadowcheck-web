import fs from 'fs';
import path from 'path';
import { isVideoMedia } from '../../client/src/components/visint/NetworkMediaViewer';

describe('NetworkMediaViewer and isVideoMedia', () => {
  describe('isVideoMedia authoritative metadata classification', () => {
    it('identifies mediaType === "video" as video regardless of filename', () => {
      expect(isVideoMedia('video', null, 'photo.jpg')).toBe(true);
      expect(isVideoMedia('video', 'application/octet-stream', 'unknown.bin')).toBe(true);
    });

    it('identifies video/* mime_type as video', () => {
      expect(isVideoMedia(null, 'video/mp4', 'file')).toBe(true);
      expect(isVideoMedia(null, 'video/quicktime', 'clip.mov')).toBe(true);
      expect(isVideoMedia(null, 'video/webm', null)).toBe(true);
    });

    it('identifies image mediaType and image/* mime_type as non-video', () => {
      expect(isVideoMedia('image', null, 'clip.mp4')).toBe(false);
      expect(isVideoMedia(null, 'image/jpeg', 'clip.mp4')).toBe(false);
      expect(isVideoMedia(null, 'image/png', null)).toBe(false);
    });

    it('falls back to filename extension only when metadata is missing', () => {
      expect(isVideoMedia(null, null, 'evidence.mp4')).toBe(true);
      expect(isVideoMedia(null, null, 'traffic.webm')).toBe(true);
      expect(isVideoMedia(null, null, 'drone.MOV')).toBe(true);
      expect(isVideoMedia(null, null, 'snapshot.JPG')).toBe(false);
      expect(isVideoMedia(null, null, 'report.pdf')).toBe(false);
      expect(isVideoMedia(null, null, null)).toBe(false);
    });
  });

  describe('Component contracts and rendering requirements', () => {
    const viewerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/visint/NetworkMediaViewer.tsx'),
      'utf8'
    );
    const managerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/visint/VisIntAttachmentsManager.tsx'),
      'utf8'
    );
    const popupSource = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'client/src/components/geospatial/media/MatchedMediaCarouselPopup.tsx'
      ),
      'utf8'
    );
    const panelSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/geospatial/panels/NetworkMediaPanel.tsx'),
      'utf8'
    );

    it('NetworkMediaViewer satisfies video element specifications', () => {
      expect(viewerSource).toContain('<video');
      expect(viewerSource).toContain('controls={controls}');
      expect(viewerSource).toContain('playsInline');
      expect(viewerSource).toContain('preload="metadata"');
      expect(viewerSource).toContain('<source src={mediaUrl}');
      expect(viewerSource).toContain('<img');
      expect(viewerSource).toContain('Failed to load');
      expect(viewerSource).toContain('/api/admin/network-media/${mediaId}/inline');
    });

    it('NetworkMediaThumbnail renders video indicator tile with Film icon and MP4 badge', () => {
      expect(viewerSource).toContain('Film');
      expect(viewerSource).toContain('MP4');
      expect(viewerSource).toContain('thumbnail=true');
    });

    it('VisIntAttachmentsManager integrates NetworkMediaViewer with metadata fields', () => {
      expect(managerSource).toContain('NetworkMediaViewer');
      expect(managerSource).toContain('media_types?: string[]');
      expect(managerSource).toContain('mime_types?: string[]');
      expect(managerSource).toContain('mediaType={group.media_types?.[index]}');
      expect(managerSource).toContain('mimeType={group.mime_types?.[index]}');
    });

    it('MatchedMediaCarouselPopup integrates NetworkMediaViewer and NetworkMediaThumbnail', () => {
      expect(popupSource).toContain('NetworkMediaViewer');
      expect(popupSource).toContain('NetworkMediaThumbnail');
      expect(popupSource).not.toContain("fontSize: '40px'");
    });

    it('NetworkMediaPanel integrates NetworkMediaThumbnail and in-app modal NetworkMediaViewer', () => {
      expect(panelSource).toContain('NetworkMediaThumbnail');
      expect(panelSource).toContain('NetworkMediaViewer');
      expect(panelSource).toContain('selectedMedia');
    });
  });
});
