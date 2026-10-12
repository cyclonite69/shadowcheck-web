import { formatRSSI } from './fieldFormatting';

type AgencyPopupProps = {
  agency?: string | null;
  name?: string;
  officeType?: string;
  distanceKm?: number | null;
  address?: string;
  phone?: string | null;
  website?: string | null;
  parentOffice?: string | null;
  hasWigleObs?: boolean;
};

type WigleObservationPopupProps = {
  ssid?: string | null;
  bssid?: string | null;
  observed_at?: string | null;
  signal?: number | string | null;
  channel?: number | string | null;
  frequency?: number | string | null;
};

type WigleNetworkPopupProps = {
  ssid?: string | null;
  name?: string | null;
  bssid?: string | null;
  last_seen?: string | null;
  encryption?: string | null;
  channel?: number | string | null;
  type?: string | null;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function safeWebsiteUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const popupShell = ({
  title,
  subtitle,
  accent,
  body,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  body: string;
}) => `
  <div style="
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.96) 0%, rgba(10, 15, 30, 0.96) 100%);
    color: #f8fafc;
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-left: 4px solid ${/^#[\da-f]{6}$/i.test(accent) ? accent : '#3b82f6'};
    border-radius: 10px;
    width: min(360px, 80vw);
    max-height: min(62vh, 520px);
    overflow-y: auto;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.75);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  ">
    <div style="padding: 10px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.2);">
      <div style="font-size: 13px; font-weight: 700; color: ${/^#[\da-f]{6}$/i.test(accent) ? accent : '#3b82f6'};">${escapeHtml(title)}</div>
      ${subtitle ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    <div style="padding: 10px 12px; font-size: 12px; line-height: 1.45; color: #e2e8f0;">
      ${body}
    </div>
  </div>
`;

export const renderCourthousePopupCard = (props: {
  name: string;
  courthouseType: string;
  district: string;
  circuit: string;
  address: string;
}) => {
  const typeMap: Record<string, string> = {
    district_court: 'District Court',
    circuit_court_of_appeals: 'Court of Appeals',
    bankruptcy_court: 'Bankruptcy Court',
    specialty_court: 'Specialty Court',
    magistrate_court: 'Magistrate Court',
  };
  const typeDisplay = typeMap[props.courthouseType] || props.courthouseType.replace('_', ' ');

  const body = `
    <div style="font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 6px;">${escapeHtml(props.name)}</div>
    <div style="margin-bottom: 8px; color: #cbd5e1; white-space: pre-line;">${escapeHtml(props.address)}</div>
    <div style="margin-bottom: 4px;"><span style="color:#94a3b8;">District:</span> ${escapeHtml(props.district)}</div>
    <div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Circuit:</span> ${escapeHtml(props.circuit)}</div>
  `;

  return popupShell({
    title: 'Federal Courthouse',
    subtitle: typeDisplay,
    accent: '#f59e0b',
    body,
  });
};

export const renderAgencyPopupCard = (props: AgencyPopupProps) => {
  const agencyName = props.agency?.trim() ? props.agency.trim().toUpperCase() : 'AGENCY';
  const officeType = props.officeType ? String(props.officeType).replace(/_/g, ' ') : 'Office';
  const officeTypeTitle = officeType.replace(/\b\w/g, (character) => character.toUpperCase());
  const website = safeWebsiteUrl(props.website);
  const body = `
    <div style="font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px;">${escapeHtml(props.name ? `${props.name} Resident Agency` : `${agencyName} Office`)}</div>
    <div style="margin-bottom: 8px; color: #cbd5e1; font-size: 12px; line-height: 1.4;">${escapeHtml(props.address || 'Address unavailable')}</div>
    ${props.distanceKm !== null && props.distanceKm !== undefined ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Distance:</span> <strong>${props.distanceKm.toFixed(1)} km</strong></div>` : ''}
    ${props.phone ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Phone:</span> <strong style="color:#f8fafc;">${escapeHtml(props.phone)}</strong></div>` : ''}
    ${props.parentOffice ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Parent Division:</span> <strong style="color:#f8fafc;">${escapeHtml(props.parentOffice)}</strong></div>` : ''}
    ${props.hasWigleObs ? '<div style="margin-top: 8px; color: #f59e0b; font-weight: 600;">WiGLE observations found near this office</div>' : ''}
    ${website ? `<div style="margin-top: 10px;"><a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: none; font-weight: 500;">Open agency portal ↗</a></div>` : ''}
  `;

  return popupShell({
    title: `${agencyName} · ${officeTypeTitle}`,
    subtitle: props.parentOffice ? `Division of ${props.parentOffice}` : undefined,
    accent: '#ef4444',
    body,
  });
};

export function renderWigleNetworkPopupCard(
  props: WigleNetworkPopupProps,
  coordinates: [number, number]
): string {
  const color = '#3b82f6';
  const ssid = props.ssid || props.name || '(hidden)';
  const bssid = props.bssid || 'Unknown BSSID';
  const location = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  const details: Array<[string, string | null | undefined]> = [
    ['Sighted', props.last_seen || 'Unknown'],
    ['Encryption', props.encryption || 'OPEN'],
    [
      'Channel',
      props.channel === null || props.channel === undefined ? null : String(props.channel),
    ],
    ['Radio Type', props.type || 'WiFi'],
    ['Location', location],
  ];
  const detailRows = details
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) => `
        <div style="font-size:12px;color:#cbd5e1;margin-top:4px;display:flex;justify-content:space-between;gap:8px;">
          <span style="color:#94a3b8;">${escapeHtml(label)}:</span>
          <strong style="color:#f8fafc;font-family:${label === 'Location' ? 'monospace' : 'inherit'};">${escapeHtml(String(value))}</strong>
        </div>
      `
    )
    .join('');

  return `
    <div style="background:#1e293b;border:1px solid ${color}44;border-radius:10px;padding:14px 16px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};">WiGLE v2 Network</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ssid)}</div>
      <div style="font-size:11px;font-family:monospace;color:#60a5fa;margin-bottom:8px;">${escapeHtml(bssid)}</div>
      ${detailRows}
    </div>
  `;
}

export function renderWigleObservationPopupCard(
  props: WigleObservationPopupProps,
  coordinates: [number, number]
): string {
  const color = '#8b5cf6';
  const signal = props.signal === null || props.signal === undefined ? null : Number(props.signal);
  const signalText = signal !== null && Number.isFinite(signal) ? formatRSSI(signal) : 'Unknown';
  const channel =
    props.channel === null || props.channel === undefined ? null : String(props.channel);
  const frequency =
    props.frequency === null || props.frequency === undefined ? null : String(props.frequency);
  const channelText =
    channel && frequency
      ? `Ch ${channel} · ${frequency} MHz`
      : channel
        ? `Ch ${channel}`
        : frequency
          ? `${frequency} MHz`
          : null;
  const location = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  const details: Array<[string, string | null]> = [
    ['Observed', props.observed_at || 'Unknown'],
    ['Signal', signalText],
    ['Channel', channelText],
    ['Location', location],
  ];
  const detailRows = details
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) => `
        <div style="font-size:12px;color:#cbd5e1;margin-top:4px;display:flex;justify-content:space-between;gap:8px;">
          <span style="color:#94a3b8;">${escapeHtml(label)}:</span>
          <strong style="color:#f8fafc;font-family:${label === 'Location' ? 'monospace' : 'inherit'};">${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join('');
  const ssid = props.ssid || '(hidden)';
  const bssid = props.bssid || 'Unknown BSSID';

  return `
    <div style="background:#1e293b;border:1px solid ${color}44;border-radius:10px;padding:14px 16px;min-width:240px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};">WiGLE v3 Observation</div>
      </div>
      <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ssid)}</div>
      <div style="font-size:11px;font-family:monospace;color:#a78bfa;margin-bottom:8px;">${escapeHtml(bssid)}</div>
      ${detailRows}
    </div>
  `;
}
