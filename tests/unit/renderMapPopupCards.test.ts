import {
  renderAgencyPopupCard,
  renderCourthousePopupCard,
  renderWigleNetworkPopupCard,
  renderWigleObservationPopupCard,
} from '../../client/src/utils/geospatial/renderMapPopupCards';

describe('renderWigleObservationPopupCard', () => {
  test('renders a compact observation card with capture time, signal, channel, and location', () => {
    const html = renderWigleObservationPopupCard(
      {
        ssid: 'Field Capture',
        bssid: 'AA:BB:CC:DD:EE:FF',
        observed_at: '2026-10-10 13:42:17',
        signal: -71,
        channel: 1,
        frequency: 2412,
      },
      [-122.123456, 47.654321]
    );

    expect(html).toContain('background:#1e293b');
    expect(html).toContain('border:1px solid #8b5cf644');
    expect(html).toContain('WiGLE v3 Observation');
    expect(html).toContain('Field Capture');
    expect(html).toContain('AA:BB:CC:DD:EE:FF');
    expect(html).toContain('2026-10-10 13:42:17');
    expect(html).toContain('-71 dBm');
    expect(html).toContain('Ch 1 · 2412 MHz');
    expect(html).toContain('47.65432, -122.12346');
    expect(html).not.toContain('Data Quality');
    expect(html).not.toContain('HOME');
    expect(html).not.toContain('<details');
  });

  test('escapes dynamic courthouse and agency text without escaping card markup', () => {
    const courthouse = renderCourthousePopupCard({
      name: '<img src=x onerror=alert(1)>',
      courthouseType: '<svg onload=alert(1)>',
      district: '" onmouseover="alert(1)',
      circuit: 'Circuit & <District>',
      address: "1 <script>alert('x')</script>",
    });
    const agency = renderAgencyPopupCard({
      agency: 'fbi',
      name: '<b>Agency</b>',
      officeType: 'resident_agency',
      address: '" autofocus onfocus="alert(1)',
      phone: '<script>bad()</script>',
      parentOffice: "Parent's Office",
      website: 'javascript:alert(1)',
    });

    expect(courthouse).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(courthouse).toContain('&quot; onmouseover=&quot;alert(1)');
    expect(courthouse).toContain('Circuit &amp; &lt;District&gt;');
    expect(courthouse).not.toContain('<script>');
    expect(courthouse).toContain('<div style=');
    expect(agency).toContain('&lt;b&gt;Agency&lt;/b&gt;');
    expect(agency).toContain('FBI · Resident Agency');
    expect(agency).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    expect(agency).not.toContain('javascript:');
    expect(agency).toContain('<div style=');
  });

  test('allows only http(s) agency website links', () => {
    const html = renderAgencyPopupCard({ website: 'https://example.test/path?a=1&b=2' });
    expect(html).toContain('href="https://example.test/path?a=1&amp;b=2"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test('renders branded agency header, full contact/address details, and parent division', () => {
    const html = renderAgencyPopupCard({
      agency: 'fbi',
      name: 'Lansing',
      officeType: 'resident_agency',
      address: '200 E Liberty St, Ann Arbor, MI 48104',
      phone: '734-555-0100',
      parentOffice: 'Detroit',
    });

    expect(html).toContain('FBI · Resident Agency');
    expect(html).toContain('Lansing Resident Agency');
    expect(html).toContain('200 E Liberty St, Ann Arbor, MI 48104');
    expect(html).toContain('734-555-0100');
    expect(html).toContain('Division of Detroit');
    expect(html).toContain('Parent Division:');
  });

  test('escapes WiGLE observation text', () => {
    const html = renderWigleObservationPopupCard(
      {
        ssid: '<iframe src=javascript:alert(1)>',
        bssid: '" onclick="alert(1)',
        observed_at: '<script>alert(1)</script>',
        signal: -71,
        channel: '" autofocus',
        frequency: '<svg>',
      },
      [1, 2]
    );
    expect(html).toContain('&lt;iframe src=javascript:alert(1)&gt;');
    expect(html).toContain('&quot; onclick=&quot;alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot; autofocus');
    expect(html).toContain('&lt;svg&gt; MHz');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<script>');
  });
});

describe('renderWigleNetworkPopupCard', () => {
  test('renders a compact network card with sighting time and location', () => {
    const html = renderWigleNetworkPopupCard(
      {
        ssid: 'Field Network',
        bssid: 'AA:BB:CC:DD:EE:FF',
        last_seen: '2026-10-10 12:34:56',
        encryption: 'WPA2',
        channel: 11,
        type: 'WiFi',
      },
      [-122.123456, 47.654321]
    );

    expect(html).toContain('background:#1e293b');
    expect(html).toContain('border:1px solid #3b82f644');
    expect(html).toContain('WiGLE v2 Network');
    expect(html).toContain('Field Network');
    expect(html).toContain('AA:BB:CC:DD:EE:FF');
    expect(html).toContain('2026-10-10 12:34:56');
    expect(html).toContain('47.65432, -122.12346');
    expect(html).not.toContain('Data Quality');
    expect(html).not.toContain('HOME');
    expect(html).not.toContain('<details');
  });

  test('escapes all feature text and honors name when SSID is absent', () => {
    const html = renderWigleNetworkPopupCard(
      {
        name: '<img src=x onerror=alert(1)>',
        bssid: '" onmouseover="alert(1)',
        last_seen: '<script>alert(1)</script>',
        encryption: 'WPA & <OPEN>',
        channel: '" autofocus',
        type: '<svg onload=alert(1)>',
      },
      [1, 2]
    );

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot; onmouseover=&quot;alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('WPA &amp; &lt;OPEN&gt;');
    expect(html).toContain('&quot; autofocus');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
  });
});
