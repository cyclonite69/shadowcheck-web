import { renderToStaticMarkup } from 'react-dom/server';
import { LayersDropdown } from '../../../client/src/components/geospatial/toolbar/MapToolbarDropdowns';

describe('LayersDropdown component', () => {
  it('renders null if no toggle callbacks are provided', () => {
    const markup = renderToStaticMarkup(
      LayersDropdown({
        layersOpen: false,
        setLayersOpen: jest.fn(),
        layersRef: { current: null },
        hasActiveLayers: false,
      }) as any
    );
    expect(markup).toBe('');
  });

  it('renders the ALPR Cameras (OSM) option with label and color when dropdown is open', () => {
    const markup = renderToStaticMarkup(
      LayersDropdown({
        layersOpen: true,
        setLayersOpen: jest.fn(),
        layersRef: { current: null },
        hasActiveLayers: true,
        onToggleAlprCameras: jest.fn(),
        showAlprCameras: true,
      }) as any
    );

    expect(markup).toContain('ALPR Cameras (OSM)');
    expect(markup).toContain('#d946ef');
    expect(markup).toContain('✓');
  });

  it('renders ALPR Cameras (OSM) as inactive when showAlprCameras is false', () => {
    const markup = renderToStaticMarkup(
      LayersDropdown({
        layersOpen: true,
        setLayersOpen: jest.fn(),
        layersRef: { current: null },
        hasActiveLayers: false,
        onToggleAlprCameras: jest.fn(),
        showAlprCameras: false,
      }) as any
    );

    expect(markup).toContain('ALPR Cameras (OSM)');
    expect(markup).toContain('rgba(255,255,255,0.5)');
    expect(markup).not.toContain('✓');
  });

  it('renders shared layer controls with opacity and ordering actions', () => {
    const markup = renderToStaticMarkup(
      LayersDropdown({
        layersOpen: true,
        setLayersOpen: jest.fn(),
        layersRef: { current: null },
        hasActiveLayers: true,
        layerOptions: [
          {
            key: 'wigleV2',
            label: 'WiGLE v2 networks',
            color: '#3b82f6',
            visible: true,
            opacity: 0.65,
            onToggle: jest.fn(),
            onOpacityChange: jest.fn(),
            onMoveUp: jest.fn(),
            onMoveDown: jest.fn(),
          },
        ],
      }) as any
    );

    expect(markup).toContain('WiGLE v2 networks');
    expect(markup).toContain('WiGLE v2 networks opacity');
    expect(markup).toContain('65%');
    expect(markup).toContain('Move WiGLE v2 networks up');
    expect(markup).toContain('Move WiGLE v2 networks down');
  });
});
