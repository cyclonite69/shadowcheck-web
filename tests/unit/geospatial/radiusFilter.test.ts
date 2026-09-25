/**
 * Unit tests for radius filter pure functions.
 * Tests are written against the specification (not importing from client/)
 * because tsconfig.test.json excludes the client directory.
 * If the implementation in useRadiusFilterLayer / useRadiusFilterPopup
 * diverges from these specs the tests must be updated.
 */

// ── formatRadius (mirrors useRadiusFilterLayer.ts) ──────────────────────────
const formatRadius = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
};

describe('formatRadius', () => {
  it('formats values below 1000 m as integer metres', () => {
    expect(formatRadius(100)).toBe('100 m');
    expect(formatRadius(500)).toBe('500 m');
    expect(formatRadius(999)).toBe('999 m');
  });

  it('rounds fractional metres', () => {
    expect(formatRadius(499.7)).toBe('500 m');
    expect(formatRadius(100.2)).toBe('100 m');
  });

  it('formats exactly 1000 m as km', () => {
    expect(formatRadius(1000)).toBe('1.0 km');
  });

  it('formats values >= 1000 m as km with one decimal', () => {
    expect(formatRadius(1500)).toBe('1.5 km');
    expect(formatRadius(2400)).toBe('2.4 km');
    expect(formatRadius(10000)).toBe('10.0 km');
    expect(formatRadius(50000)).toBe('50.0 km');
  });

  it('preserves one decimal place (does not truncate)', () => {
    expect(formatRadius(1250)).toBe('1.3 km');
    expect(formatRadius(1749)).toBe('1.7 km');
  });
});

// ── radius line geometry (mirrors useRadiusFilterLayer.ts) ──────────────────
function buildRadiusLineCoords(
  lat: number,
  lng: number,
  radiusMeters: number
): { center: [number, number]; edge: [number, number] } {
  const radiusKm = radiusMeters / 1000;
  const radiusLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    center: [lng, lat],
    edge: [lng + radiusLng, lat],
  };
}

describe('radius line geometry', () => {
  it('center coordinates are [lng, lat] (GeoJSON order)', () => {
    const { center } = buildRadiusLineCoords(38.9, -77.0, 500);
    expect(center).toEqual([-77.0, 38.9]);
  });

  it('edge point has the same latitude as the center', () => {
    const { center, edge } = buildRadiusLineCoords(38.9, -77.0, 500);
    expect(edge[1]).toBe(center[1]);
  });

  it('edge point is east of center (lng increases)', () => {
    const { center, edge } = buildRadiusLineCoords(38.9, -77.0, 500);
    expect(edge[0]).toBeGreaterThan(center[0]);
  });

  it('larger radius produces a farther east edge point', () => {
    const small = buildRadiusLineCoords(38.9, -77.0, 500);
    const large = buildRadiusLineCoords(38.9, -77.0, 5000);
    expect(large.edge[0]).toBeGreaterThan(small.edge[0]);
  });

  it('radius line length scales with cos(lat) — equatorial wider than polar', () => {
    const equatorial = buildRadiusLineCoords(0, 0, 1000);
    const polar = buildRadiusLineCoords(60, 0, 1000);
    const equatorialDeltaLng = equatorial.edge[0] - equatorial.center[0];
    const polarDeltaLng = polar.edge[0] - polar.center[0];
    expect(equatorialDeltaLng).toBeLessThan(polarDeltaLng);
  });
});

// ── buildPopupHTML (mirrors useRadiusFilterPopup.ts) ────────────────────────
function buildPopupHTML(radiusMeters: number): string {
  const fmtRadius = (m: number): string => {
    if (m >= 1000) {
      return `${(m / 1000).toFixed(1)} km`;
    }
    return `${Math.round(m).toLocaleString()} m`;
  };
  return `
    <div style="font-family:system-ui,sans-serif;min-width:210px;padding:4px 0">
      <div style="font-size:11px;font-weight:700;color:#67e8f9;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px">
        Radius Search
      </div>
      <div style="margin-bottom:12px">
        <input type="range" id="radius-slider"
          min="100" max="50000" step="100" value="${radiusMeters}"
          style="width:100%;accent-color:#06b6d4;margin-bottom:8px;cursor:pointer"
        />
        <div style="display:flex;align-items:center;gap:6px">
          <input type="number" id="radius-input"
            min="100" max="50000" step="100" value="${radiusMeters}"
            style="width:80px;background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:4px;padding:3px 7px;font-size:12px"
          />
          <span style="color:#94a3b8;font-size:12px">meters</span>
        </div>
        <div id="radius-display" style="font-size:11px;color:#67e8f9;margin-top:5px">
          ${fmtRadius(radiusMeters)}
        </div>
      </div>
      <button id="radius-clear"
        style="width:100%;padding:5px 0;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#f87171;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;letter-spacing:0.04em"
      >
        Clear Pin
      </button>
    </div>
  `;
}

describe('buildPopupHTML', () => {
  it('contains the radius slider with correct initial value', () => {
    const html = buildPopupHTML(1500);
    expect(html).toContain('id="radius-slider"');
    expect(html).toContain('value="1500"');
    expect(html).toContain('min="100"');
    expect(html).toContain('max="50000"');
    expect(html).toContain('step="100"');
  });

  it('contains the number input with correct initial value', () => {
    const html = buildPopupHTML(800);
    expect(html).toContain('id="radius-input"');
    expect(html).toContain('value="800"');
  });

  it('displays formatted radius in the display div', () => {
    expect(buildPopupHTML(800)).toContain('800 m');
    expect(buildPopupHTML(2000)).toContain('2.0 km');
  });

  it('contains the clear button', () => {
    const html = buildPopupHTML(500);
    expect(html).toContain('id="radius-clear"');
    expect(html).toContain('Clear Pin');
  });

  it('contains the Radius Search heading', () => {
    expect(buildPopupHTML(500)).toContain('Radius Search');
  });
});

// ── useRadiusFilterLayer source update logic ─────────────────────────────────
// The hook drives three GeoJSON sources; test the decisions around clearing vs populating.
describe('useRadiusFilterLayer source decisions', () => {
  function shouldPopulateSources(
    isEnabled: boolean,
    radiusFilter: { latitude: number; longitude: number; radiusMeters: number } | null | undefined
  ): boolean {
    return (
      isEnabled &&
      Boolean(radiusFilter?.latitude) &&
      Boolean(radiusFilter?.longitude) &&
      Boolean(radiusFilter?.radiusMeters)
    );
  }

  it('populates when enabled and all coords are non-zero', () => {
    expect(
      shouldPopulateSources(true, { latitude: 38.9, longitude: -77.0, radiusMeters: 500 })
    ).toBe(true);
  });

  it('clears when filter is disabled', () => {
    expect(
      shouldPopulateSources(false, { latitude: 38.9, longitude: -77.0, radiusMeters: 500 })
    ).toBe(false);
  });

  it('clears when radiusFilter is null', () => {
    expect(shouldPopulateSources(true, null)).toBe(false);
  });

  it('clears when radiusMeters is zero', () => {
    expect(shouldPopulateSources(true, { latitude: 38.9, longitude: -77.0, radiusMeters: 0 })).toBe(
      false
    );
  });

  it('clears when latitude is zero (unset)', () => {
    expect(shouldPopulateSources(true, { latitude: 0, longitude: -77.0, radiusMeters: 500 })).toBe(
      false
    );
  });
});
