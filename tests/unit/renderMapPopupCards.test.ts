import {
  renderAgencyPopupCard,
  renderWigleObservationPopupCard,
} from '../../client/src/utils/geospatial/renderMapPopupCards';

describe('renderMapPopupCards', () => {
  it('renders agency popup card with core fields', () => {
    const html = renderAgencyPopupCard({
      name: 'FBI Detroit',
      officeType: 'field_office',
      distanceKm: 3.2,
      address: '123 Main St, Detroit, MI',
      hasWigleObs: true,
    });

    expect(html).toContain('Agency Location');
    expect(html).toContain('FBI Detroit');
    expect(html).toContain('field office');
    expect(html).toContain('3.2 km');
    expect(html).toContain('WiGLE observations found near this office');
  });

  it('renders wigle observation card in matched mode', () => {
    const html = renderWigleObservationPopupCard({
      ssid: 'TestAP',
      signal: -55,
      matched: true,
    });

    expect(html).toContain('WiGLE + Local Match');
    expect(html).toContain('TestAP');
    expect(html).toContain('-55 dBm');
  });
});
