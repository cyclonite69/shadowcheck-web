import { renderWigleObservationPopupCard } from '../../client/src/utils/geospatial/renderMapPopupCards';

describe('renderWigleObservationPopupCard', () => {
  test('formats numeric-string epoch time without Invalid Date', () => {
    const html = renderWigleObservationPopupCard({
      ssid: 'FBI Truck',
      time: '1739400000000',
      signal: -94,
      matched: false,
    });

    expect(html).not.toContain('Invalid Date');
    expect(html).toContain('Time:');
  });

  test('falls back to Unknown for invalid time values', () => {
    const html = renderWigleObservationPopupCard({
      ssid: 'FBI Truck',
      time: 'not-a-date',
      signal: -94,
      matched: false,
    });

    expect(html).toContain('Time:</span> Unknown');
  });
});
