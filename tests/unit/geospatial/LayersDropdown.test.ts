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
});
