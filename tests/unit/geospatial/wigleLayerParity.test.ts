import {
  FIELD_OFFICE_LABEL,
  RESIDENT_AGENCY_LABEL,
  FEDERAL_COURTHOUSE_LABEL,
  FIELD_OFFICE_COLOR,
  RESIDENT_AGENCY_COLOR,
  FEDERAL_COURTHOUSE_COLOR,
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
import fs from 'fs';
import path from 'path';

describe('WiGLE Layer Parity on Geospatial Page', () => {
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

    expect(FIELD_OFFICE_COLOR).toBe('#dc2626');
    expect(RESIDENT_AGENCY_COLOR).toBe('#f97316');
    expect(FEDERAL_COURTHOUSE_COLOR).toBe('#f59e0b');
  });

  it('maps GEOSPATIAL_LAYER_IDS directly to real IDs created by the hooks', () => {
    expect(GEOSPATIAL_LAYER_IDS.fieldOffices).toEqual(FIELD_OFFICE_LAYER_IDS);
    expect(GEOSPATIAL_LAYER_IDS.residentAgencies).toEqual(RESIDENT_AGENCY_LAYER_IDS);
    expect(GEOSPATIAL_LAYER_IDS.courthouses).toEqual(COURTHOUSE_LAYER_IDS);

    expect(GEOSPATIAL_LAYER_IDS).not.toHaveProperty('agencies');
  });

  it('ensures both WiGLE page and Geospatial page consume the same hooks and constants', () => {
    const geospatialExplorerSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/components/GeospatialExplorer.tsx'),
      'utf8'
    );
    const wiglePageSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/components/WiglePage.tsx'),
      'utf8'
    );
    const wigleControlPanelSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../client/src/components/WigleControlPanel.tsx'),
      'utf8'
    );

    expect(geospatialExplorerSrc).toContain("from './hooks/useAgencyOffices'");
    expect(geospatialExplorerSrc).toContain("from './hooks/useFederalCourthouses'");
    expect(wiglePageSrc).toContain("from './hooks/useAgencyOffices'");
    expect(wiglePageSrc).toContain("from './hooks/useFederalCourthouses'");

    expect(typeof useAgencyOffices).toBe('function');
    expect(typeof useFederalCourthouses).toBe('function');

    expect(wigleControlPanelSrc).toContain('agencyCourthouseStyles');
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
