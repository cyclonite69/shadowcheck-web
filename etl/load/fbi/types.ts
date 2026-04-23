export type OfficeType = 'field_office' | 'resident_agency';

export interface OfficeRecord {
  agency: string;
  officeType: OfficeType;
  name: string;
  parentOffice?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
  jurisdiction?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceUrl: string;
  sourceRetrievedAt: Date;
}
