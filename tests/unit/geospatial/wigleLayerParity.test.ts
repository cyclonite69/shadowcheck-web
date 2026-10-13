export {};

const stateMap: Record<number, any> = {};
let stateCallIndex = 0;

jest.mock('react', () => ({
  useState: (initial: any) => {
    const key = stateCallIndex++;
    if (!(key in stateMap)) {
      stateMap[key] = typeof initial === 'function' ? initial() : initial;
    }
    const setter = (val: any) => {
      stateMap[key] = typeof val === 'function' ? val(stateMap[key]) : val;
    };
    return [stateMap[key], setter];
  },
  useCallback: (callback: any) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    return effect();
  },
  useMemo: (factory: any) => factory(),
  useRef: (initial: any) => ({ current: initial }),
}));

const mockGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-84, 42] },
      properties: {},
    },
  ],
};

jest.mock('../../../client/src/hooks/useAsyncData', () => ({
  useAsyncData: () => ({
    data: mockGeoJson,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

import {
  FIELD_OFFICE_LABEL,
  RESIDENT_AGENCY_LABEL,
  FEDERAL_COURTHOUSE_LABEL,
  FIELD_OFFICE_COLOR,
  RESIDENT_AGENCY_COLOR,
  FEDERAL_COURTHOUSE_COLOR,
  DISTRICT_COURT_COLOR,
  CIRCUIT_COURT_COLOR,
  SPECIALTY_COURT_COLOR,
  COURTHOUSE_CLUSTER_COLOR,
  FIELD_OFFICE_LAYER_IDS,
  RESIDENT_AGENCY_LAYER_IDS,
  COURTHOUSE_LAYER_IDS,
} from '../../../client/src/constants/agencyCourthouseStyles';
import {
  GEOSPATIAL_LAYER_LABELS,
  GEOSPATIAL_LAYER_COLORS,
  GEOSPATIAL_LAYER_IDS,
  DEFAULT_GEOSPATIAL_LAYER_ORDER,
} from '../../../client/src/components/geospatial/layers/layerCatalog';
import { useAgencyOffices } from '../../../client/src/components/hooks/useAgencyOffices';
import { useFederalCourthouses } from '../../../client/src/components/hooks/useFederalCourthouses';

describe('WiGLE Layer Parity on Geospatial Page', () => {
  beforeEach(() => {
    stateCallIndex = 0;
    for (const key of Object.keys(stateMap)) {
      delete stateMap[Number(key)];
    }
  });

  it('shares labels with WiGLE page definitions via shared constants', () => {
    expect(GEOSPATIAL_LAYER_LABELS.fieldOffices).toBe(FIELD_OFFICE_LABEL);
    expect(GEOSPATIAL_LAYER_LABELS.residentAgencies).toBe(RESIDENT_AGENCY_LABEL);
    expect(GEOSPATIAL_LAYER_LABELS.courthouses).toBe(FEDERAL_COURTHOUSE_LABEL);

    expect(FIELD_OFFICE_LABEL).toBe('Field Offices');
    expect(RESIDENT_AGENCY_LABEL).toBe('Resident Agencies');
    expect(FEDERAL_COURTHOUSE_LABEL).toBe('Federal Courthouses');
  });

  it('shares colors with WiGLE page definitions via shared constants', () => {
    expect(GEOSPATIAL_LAYER_COLORS.fieldOffices).toBe(FIELD_OFFICE_COLOR);
    expect(GEOSPATIAL_LAYER_COLORS.residentAgencies).toBe(RESIDENT_AGENCY_COLOR);
    expect(GEOSPATIAL_LAYER_COLORS.courthouses).toBe(FEDERAL_COURTHOUSE_COLOR);
  });

  it('pins literal hex styles and unclustered/cluster radii matching 6899c56f baseline', () => {
    // Pinned literal hex values
    expect(FIELD_OFFICE_COLOR).toBe('#dc2626');
    expect(RESIDENT_AGENCY_COLOR).toBe('#f97316');
    expect(FEDERAL_COURTHOUSE_COLOR).toBe('#f59e0b');
    expect(DISTRICT_COURT_COLOR).toBe('#f59e0b');
    expect(CIRCUIT_COURT_COLOR).toBe('#a855f7');
    expect(SPECIALTY_COURT_COLOR).toBe('#06b6d4');
    expect(COURTHOUSE_CLUSTER_COLOR).toBe('#f59e0b');
  });

  it('maps GEOSPATIAL_LAYER_IDS directly to real IDs created by the hooks', () => {
    expect(GEOSPATIAL_LAYER_IDS.fieldOffices).toEqual(FIELD_OFFICE_LAYER_IDS);
    expect(GEOSPATIAL_LAYER_IDS.residentAgencies).toEqual(RESIDENT_AGENCY_LAYER_IDS);
    expect(GEOSPATIAL_LAYER_IDS.courthouses).toEqual(COURTHOUSE_LAYER_IDS);

    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('agencies');
  });

  it('mounts useAgencyOffices and useFederalCourthouses on fakeMap capturing addLayer with pinned styles and parity constants', () => {
    const addedLayers: any[] = [];
    const fakeMap: any = {
      getStyle: jest.fn(() => ({ version: 8 })),
      getSource: jest.fn(() => null),
      addSource: jest.fn(),
      getLayer: jest.fn((id: string) => addedLayers.find((l) => l.id === id)),
      addLayer: jest.fn((layer: any) => {
        addedLayers.push(layer);
      }),
      setLayoutProperty: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    const mapRef = { current: fakeMap };

    useAgencyOffices(
      mapRef,
      true,
      { fieldOffices: true, residentAgencies: true },
      { current: null },
      true
    );
    useFederalCourthouses(mapRef, true, true, { current: null }, true);

    const layerMap = new Map(addedLayers.map((l) => [l.id, l]));

    // Assert all 9 layers were added
    expect(addedLayers.map((l) => l.id)).toEqual([
      'agency-clusters',
      'agency-cluster-count',
      'agency-field-unclustered',
      'agency-resident-unclustered',
      'courthouse-clusters',
      'courthouse-cluster-count',
      'courthouse-district',
      'courthouse-circuit',
      'courthouse-specialty',
    ]);

    // 1. Agency clusters: circle-color matches FIELD_OFFICE_COLOR and pinned literal '#dc2626'
    const agencyClusters = layerMap.get('agency-clusters');
    expect(agencyClusters.paint['circle-color']).toBe(FIELD_OFFICE_COLOR);
    expect(agencyClusters.paint['circle-color']).toBe('#dc2626');
    expect(agencyClusters.paint['circle-radius']).toEqual([
      'step',
      ['get', 'point_count'],
      15,
      10,
      20,
      50,
      25,
    ]);
    expect(agencyClusters.filter).toEqual(['has', 'point_count']);

    // 2. Agency Field Offices unclustered: circle-color matches FIELD_OFFICE_COLOR and pinned literal '#dc2626', radius 6
    const fieldUnclustered = layerMap.get('agency-field-unclustered');
    expect(fieldUnclustered.paint['circle-color']).toBe(FIELD_OFFICE_COLOR);
    expect(fieldUnclustered.paint['circle-color']).toBe('#dc2626');
    expect(fieldUnclustered.paint['circle-radius']).toBe(6);
    expect(fieldUnclustered.filter).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'office_type'], 'field_office'],
    ]);

    // 3. Agency Resident Agencies unclustered: circle-color matches RESIDENT_AGENCY_COLOR and pinned literal '#f97316', radius 6
    const residentUnclustered = layerMap.get('agency-resident-unclustered');
    expect(residentUnclustered.paint['circle-color']).toBe(RESIDENT_AGENCY_COLOR);
    expect(residentUnclustered.paint['circle-color']).toBe('#f97316');
    expect(residentUnclustered.paint['circle-radius']).toBe(6);
    expect(residentUnclustered.filter).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'office_type'], 'resident_agency'],
    ]);

    // 4. Courthouse clusters: circle-color matches COURTHOUSE_CLUSTER_COLOR and pinned literal '#f59e0b'
    const courthouseClusters = layerMap.get('courthouse-clusters');
    expect(courthouseClusters.paint['circle-color']).toBe(COURTHOUSE_CLUSTER_COLOR);
    expect(courthouseClusters.paint['circle-color']).toBe('#f59e0b');
    expect(courthouseClusters.paint['circle-radius']).toEqual([
      'step',
      ['get', 'point_count'],
      15,
      10,
      20,
      50,
      25,
    ]);
    expect(courthouseClusters.filter).toEqual(['has', 'point_count']);

    // 5. Courthouse District Court: circle-color matches DISTRICT_COURT_COLOR / FEDERAL_COURTHOUSE_COLOR and pinned literal '#f59e0b', radius 6
    const districtCourt = layerMap.get('courthouse-district');
    expect(districtCourt.paint['circle-color']).toBe(DISTRICT_COURT_COLOR);
    expect(districtCourt.paint['circle-color']).toBe(FEDERAL_COURTHOUSE_COLOR);
    expect(districtCourt.paint['circle-color']).toBe('#f59e0b');
    expect(districtCourt.paint['circle-radius']).toBe(6);
    expect(districtCourt.filter).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'courthouse_type'], 'district_court'],
    ]);

    // 6. Courthouse Circuit Court: circle-color matches CIRCUIT_COURT_COLOR and pinned literal '#a855f7', radius 7
    const circuitCourt = layerMap.get('courthouse-circuit');
    expect(circuitCourt.paint['circle-color']).toBe(CIRCUIT_COURT_COLOR);
    expect(circuitCourt.paint['circle-color']).toBe('#a855f7');
    expect(circuitCourt.paint['circle-radius']).toBe(7);
    expect(circuitCourt.filter).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'courthouse_type'], 'circuit_court_of_appeals'],
    ]);

    // 7. Courthouse Specialty Court: circle-color matches SPECIALTY_COURT_COLOR and pinned literal '#06b6d4', radius 5
    const specialtyCourt = layerMap.get('courthouse-specialty');
    expect(specialtyCourt.paint['circle-color']).toBe(SPECIALTY_COURT_COLOR);
    expect(specialtyCourt.paint['circle-color']).toBe('#06b6d4');
    expect(specialtyCourt.paint['circle-radius']).toBe(5);
    expect(specialtyCourt.filter).toEqual([
      'all',
      ['!', ['has', 'point_count']],
      [
        '!',
        [
          'in',
          ['get', 'courthouse_type'],
          ['literal', ['district_court', 'circuit_court_of_appeals']],
        ],
      ],
    ]);
  });

  it('defines the expected complete layer order in layerCatalog', () => {
    expect(DEFAULT_GEOSPATIAL_LAYER_ORDER).toEqual([
      'home',
      'wigleV2',
      'wigleV3',
      'wigleKml',
      'fieldObservations',
      'fieldOffices',
      'residentAgencies',
      'courthouses',
      'alpr',
      'shotspotterZones',
      'shotspotterSensors',
    ]);
  });
});
