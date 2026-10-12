import type { Map } from 'mapbox-gl';
import {
  attachFieldDataMvtHandlers,
  renderFieldDataPopupCard,
} from '../../../client/src/components/geospatial/layers/fieldDataMvtHandlers';
import { getPopupAnchor } from '../../../client/src/utils/geospatial/popupAnchor';
import { cleanupPopupDrag } from '../../../client/src/utils/geospatial/setupPopupDrag';
import { setupPopupPin } from '../../../client/src/utils/geospatial/setupPopupPin';

jest.mock('../../../client/src/utils/geospatial/popupAnchor', () => ({
  getPopupAnchor: jest.fn(() => 'top-left'),
}));
jest.mock('../../../client/src/utils/geospatial/setupPopupDrag', () => ({
  setupPopupDrag: jest.fn(() => ({ isDragging: false })),
  cleanupPopupDrag: jest.fn(),
}));
jest.mock('../../../client/src/utils/geospatial/setupPopupPin', () => ({
  setupPopupPin: jest.fn(() => jest.fn()),
}));

describe('field data MVT handlers', () => {
  it('renders observation fields as escaped HTML and applies signal color bands', () => {
    const html = renderFieldDataPopupCard(
      {
        id: '17',
        bssid: '<script>alert(1)</script>',
        ssid: 'A&B "Guest"',
        level: '-72',
        radio_type: '<img src=x>',
      },
      [-122.4, 37.7]
    );

    expect(html).toContain('color:#f59e0b');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A&amp;B &quot;Guest&quot;');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).toContain('ID: <strong style="color:#f8fafc;">17</strong>');
    expect(html).toContain('37.7, -122.4');
    expect(html).not.toContain('<script>');
  });

  it('binds hover and click handlers, renders a popup, and removes listeners', () => {
    jest.mocked(getPopupAnchor).mockReturnValue('top-left');
    const pinCleanup = jest.fn();
    jest.mocked(setupPopupPin).mockReturnValue(pinCleanup);
    const handlers: Record<string, (...args: any[]) => void> = {};
    const canvas = { style: { cursor: '' } };
    const popup = {
      setLngLat: jest.fn().mockReturnThis(),
      setHTML: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      getElement: jest.fn().mockReturnValue(null),
      remove: jest.fn().mockReturnThis(),
    };
    const Popup = jest.fn().mockReturnValue(popup);
    const mapboxgl = { Popup };
    const map = {
      on: jest.fn((event: string, layer: string, handler: (...args: any[]) => void) => {
        handlers[`${event}:${layer}`] = handler;
      }),
      off: jest.fn(),
      getCanvas: jest.fn(() => canvas),
      getContainer: jest.fn(),
      project: jest.fn(),
    } as unknown as Map;

    const cleanup = attachFieldDataMvtHandlers(map, mapboxgl as any);

    expect(map.on).toHaveBeenCalledTimes(3);
    expect(map.on).toHaveBeenCalledWith(
      'mouseenter',
      'wigle-field-mvt-points',
      expect.any(Function)
    );
    expect(map.on).toHaveBeenCalledWith(
      'mouseleave',
      'wigle-field-mvt-points',
      expect.any(Function)
    );
    expect(map.on).toHaveBeenCalledWith('click', 'wigle-field-mvt-points', expect.any(Function));

    handlers['mouseenter:wigle-field-mvt-points']();
    expect(canvas.style.cursor).toBe('pointer');
    handlers['mouseleave:wigle-field-mvt-points']();
    expect(canvas.style.cursor).toBe('');

    handlers['click:wigle-field-mvt-points']({
      features: [
        {
          properties: {
            id: 17,
            bssid: 'AA:BB:CC:DD:EE:FF',
            ssid: 'Field Network',
            level: -61,
            radio_type: 'Wi-Fi',
          },
        },
      ],
      lngLat: { lng: -122.4, lat: 37.7 },
    });

    expect(Popup).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: 'top-left',
        offset: 12,
        className: 'sc-popup',
        maxWidth: '300px',
      })
    );
    expect(popup.setLngLat).toHaveBeenCalledWith({ lng: -122.4, lat: 37.7 });
    expect(popup.setHTML).toHaveBeenCalledWith(expect.stringContaining('Field Network'));
    expect(popup.addTo).toHaveBeenCalledWith(map);
    popup.remove();
    expect(cleanupPopupDrag).toHaveBeenCalledTimes(1);
    expect(pinCleanup).toHaveBeenCalledTimes(1);

    cleanup();
    expect(map.off).toHaveBeenCalledTimes(3);
    expect(map.off).toHaveBeenCalledWith(
      'mouseenter',
      'wigle-field-mvt-points',
      handlers['mouseenter:wigle-field-mvt-points']
    );
    expect(map.off).toHaveBeenCalledWith(
      'mouseleave',
      'wigle-field-mvt-points',
      handlers['mouseleave:wigle-field-mvt-points']
    );
    expect(map.off).toHaveBeenCalledWith(
      'click',
      'wigle-field-mvt-points',
      handlers['click:wigle-field-mvt-points']
    );
  });
});
