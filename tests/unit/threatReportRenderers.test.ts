export {};

const {
  renderMarkdown,
  renderHtml,
  renderPdfBuffer,
} = require('../../server/src/services/reports/threatReportRenderers');

const sampleReport = {
  generatedAt: '2026-03-04 13:00:00 UTC',
  network: {
    bssid: '00:14:3E:AF:1F:40',
    ssid: 'PAS-323',
    manufacturer: 'AirLink Communications, Inc.',
    type: 'W',
    encryption: 'WPA2',
    isIgnored: false,
    threatTag: 'INVESTIGATE',
  },
  threat: {
    finalThreatLevel: 'CRITICAL',
    finalThreatScore: 71.51,
    ruleBasedScore: 56.51,
  },
  observations: {
    count: 41,
    uniqueDays: 21,
    spanDays: 489.4,
    firstSeen: '2024-10-06 17:07:29 UTC',
    lastSeen: '2026-02-08 02:42:50 UTC',
    behavioralContext: {
      homeLikeCount: 33,
      homeLikePct: 80.5,
      followEventCount: 8,
      followEventPct: 19.5,
    },
    distanceBuckets: {
      home: 27,
      near: 6,
      neighborhood: 3,
      away: 5,
      unknown: 0,
    },
    awayLocations: [
      {
        lat: 42.944338,
        lon: -83.727017,
        time: Date.UTC(2025, 5, 25, 22, 30, 42),
        distanceKm: 9.13,
        signal: -87,
      },
    ],
  },
};

describe('threatReportRenderers', () => {
  test('renderMarkdown includes report sections and map links', () => {
    const md = renderMarkdown(sampleReport);
    expect(md).toContain('# Threat Report: 00:14:3E:AF:1F:40');
    expect(md).toContain('## Behavioral Context');
    expect(md).toContain('Follow-type events (>=0.5 km from home): 8/41 (19.5%)');
    expect(md).toContain('[Map](https://www.google.com/maps?q=42.944338,-83.727017)');
    expect(md).toContain('[Street View](');
  });

  test('renderHtml includes escaped values and away-location links', () => {
    const html = renderHtml({
      ...sampleReport,
      network: {
        ...sampleReport.network,
        ssid: 'PAS-323 <unsafe>',
      },
    });
    expect(html).toContain('<h1>Threat Report</h1>');
    expect(html).toContain('PAS-323 &lt;unsafe&gt;');
    expect(html).toContain('Map</a>');
    expect(html).toContain('Street View</a>');
  });

  test('renderPdfBuffer either returns PDF bytes or explicit missing-dependency error', async () => {
    try {
      const buf = await renderPdfBuffer(sampleReport);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(100);
      expect(buf.toString('ascii', 0, 4)).toBe('%PDF');
    } catch (err: any) {
      expect(err?.message || err?.code).toBe('PDFKIT_NOT_INSTALLED');
    }
  });

  test('renderMarkdown handles empty awayLocations and missing scores', () => {
    const md = renderMarkdown({
      ...sampleReport,
      threat: {
        ...sampleReport.threat,
        finalThreatScore: null,
        ruleBasedScore: null,
      },
      observations: {
        ...sampleReport.observations,
        awayLocations: [],
      },
    });
    expect(md).toContain('- Final Threat Score: N/A');
    expect(md).toContain('- Rule-Based Score: N/A');
    expect(md).toContain('- None');
  });

  test('renderHtml handles empty awayLocations', () => {
    const html = renderHtml({
      ...sampleReport,
      observations: {
        ...sampleReport.observations,
        awayLocations: [],
      },
    });
    expect(html).toContain('<tr><td colspan="5">None</td></tr>');
  });

  test('renderPdfBuffer handles empty awayLocations and missing scores', async () => {
    try {
      const buf = await renderPdfBuffer({
        ...sampleReport,
        threat: {
          ...sampleReport.threat,
          finalThreatScore: null,
          ruleBasedScore: null,
        },
        observations: {
          ...sampleReport.observations,
          awayLocations: [],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
    } catch (err: any) {
      expect(err?.message || err?.code).toBe('PDFKIT_NOT_INSTALLED');
    }
  });

  test('renderPdfBuffer handles missing streetUrl and mapsUrl in awayLocations', async () => {
    jest.mock('../../server/src/services/reports/threatReportUtils', () => {
      const original = jest.requireActual('../../server/src/services/reports/threatReportUtils');
      return {
        ...original,
        buildGoogleMapsUrl: () => null,
        buildStreetViewUrl: () => null,
      };
    });

    // Need to re-require if the mock is applied, but since it's already required at top level,
    // we can test the behavior by omitting lat/lon if the utility allows it, or we can just
    // rely on a report that yields no URLs. Wait, buildGoogleMapsUrl returns null if lat/lon are missing.
    try {
      const buf = await renderPdfBuffer({
        ...sampleReport,
        observations: {
          ...sampleReport.observations,
          awayLocations: [
            {
              lat: null,
              lon: null,
              time: Date.UTC(2025, 5, 25, 22, 30, 42),
              distanceKm: 9.13,
              signal: null,
            },
          ],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
    } catch (err: any) {
      expect(err?.message || err?.code).toBe('PDFKIT_NOT_INSTALLED');
    }
  });

  test('renderMarkdown handles missing optional fields to cover optional chaining', () => {
    const md = renderMarkdown({
      ...sampleReport,
      network: {
        ...sampleReport.network,
        threatTag: null,
      },
      threat: {
        ...sampleReport.threat,
        finalThreatScore: null,
        ruleBasedScore: null,
      },
      observations: {
        ...sampleReport.observations,
        awayLocations: [
          {
            lat: null,
            lon: null,
            time: Date.UTC(2025, 5, 25, 22, 30, 42),
            distanceKm: null,
            signal: null,
          },
        ],
      },
    });
    expect(md).toContain('- Threat Tag: N/A');
    expect(md).toContain('- Final Threat Score: N/A');
    expect(md).toContain('- Rule-Based Score: N/A');
    expect(md).toContain('N/A dBm');
  });

  test('renderHtml handles missing optional fields to cover optional chaining', () => {
    const html = renderHtml({
      ...sampleReport,
      network: {
        ...sampleReport.network,
        threatTag: '',
      },
      threat: {
        ...sampleReport.threat,
        finalThreatScore: null,
        ruleBasedScore: null,
      },
      observations: {
        ...sampleReport.observations,
        awayLocations: [
          {
            lat: null,
            lon: null,
            time: Date.UTC(2025, 5, 25, 22, 30, 42),
            distanceKm: null,
            signal: null,
          },
        ],
      },
    });
    expect(html).toContain('Threat Tag</b><br/>N/A');
    expect(html).toContain('Final Threat Score</b><br/>N/A');
    expect(html).toContain('Rule-Based Score</b><br/>N/A');
    expect(html).toContain('<td>N/A</td>');
  });

  test('renderPdfBuffer handles missing optional fields to cover optional chaining', async () => {
    try {
      const buf = await renderPdfBuffer({
        ...sampleReport,
        network: {
          ...sampleReport.network,
          threatTag: '',
          isIgnored: true,
        },
        threat: {
          ...sampleReport.threat,
          finalThreatScore: null,
          ruleBasedScore: null,
        },
        observations: {
          ...sampleReport.observations,
          awayLocations: [
            {
              lat: null,
              lon: null,
              time: Date.UTC(2025, 5, 25, 22, 30, 42),
              distanceKm: null,
              signal: null,
            },
          ],
        },
      });
      expect(Buffer.isBuffer(buf)).toBe(true);
    } catch (err: any) {
      expect(err?.message || err?.code).toBe('PDFKIT_NOT_INSTALLED');
    }
  });

  test('renderPdfBuffer throws error when pdfkit is missing', async () => {
    jest.resetModules();
    jest.doMock('pdfkit', () => {
      throw new Error('Module not found');
    });

    const {
      renderPdfBuffer: mockedRenderPdfBuffer,
    } = require('../../server/src/services/reports/threatReportRenderers');

    try {
      await mockedRenderPdfBuffer(sampleReport);
      // If it doesn't throw, we should fail the test
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('PDFKIT_NOT_INSTALLED');
    }
  });
});
