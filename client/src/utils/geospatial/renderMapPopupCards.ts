type AgencyPopupProps = {
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
  time?: string | null;
  signal?: number | string | null;
  channel?: number | string | null;
  distanceFromCenterMeters?: number | null;
  matched?: boolean;
};

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
    border-left: 4px solid ${accent};
    border-radius: 10px;
    width: min(360px, 80vw);
    max-height: min(62vh, 520px);
    overflow-y: auto;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.75);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  ">
    <div style="padding: 10px 12px; border-bottom: 1px solid rgba(148, 163, 184, 0.2);">
      <div style="font-size: 13px; font-weight: 700; color: ${accent};">${title}</div>
      ${subtitle ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">${subtitle}</div>` : ''}
    </div>
    <div style="padding: 10px 12px; font-size: 12px; line-height: 1.45; color: #e2e8f0;">
      ${body}
    </div>
  </div>
`;

export const renderAgencyPopupCard = (props: AgencyPopupProps) => {
  const officeType = props.officeType ? String(props.officeType).replace('_', ' ') : 'Office';
  const body = `
    <div style="font-size: 14px; font-weight: 600; color: #f8fafc; margin-bottom: 6px;">${props.name || 'Agency Office'}</div>
    <div style="margin-bottom: 8px; color: #cbd5e1;">${props.address || 'Address unavailable'}</div>
    ${props.distanceKm != null ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Distance:</span> <strong>${props.distanceKm.toFixed(1)} km</strong></div>` : ''}
    ${props.phone ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Phone:</span> ${props.phone}</div>` : ''}
    ${props.parentOffice ? `<div style="margin-bottom: 4px;"><span style="color:#94a3b8;">Parent:</span> ${props.parentOffice}</div>` : ''}
    ${props.hasWigleObs ? `<div style="margin-top: 8px; color: #f59e0b; font-weight: 600;">WiGLE observations found near this office</div>` : ''}
    ${props.website ? `<div style="margin-top: 8px;"><a href="${props.website}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: none;">Open website ↗</a></div>` : ''}
  `;

  return popupShell({
    title: 'Agency Location',
    subtitle: officeType,
    accent: '#ef4444',
    body,
  });
};

export const renderWigleObservationPopupCard = (props: WigleObservationPopupProps) => {
  const timeText = props.time ? new Date(props.time).toLocaleString() : 'Unknown';
  const signalText = props.signal != null ? `${props.signal} dBm` : 'Unknown';
  const channelText = props.channel != null ? String(props.channel) : null;
  const distanceText =
    props.distanceFromCenterMeters != null
      ? `${(props.distanceFromCenterMeters / 1000).toFixed(1)} km from your sightings centroid`
      : null;
  const matched = Boolean(props.matched);

  const body = `
    <div style="margin-bottom: 6px;"><span style="color:#94a3b8;">SSID:</span> <strong>${props.ssid || '(hidden)'}</strong></div>
    <div style="margin-bottom: 6px;"><span style="color:#94a3b8;">Time:</span> ${timeText}</div>
    <div style="margin-bottom: 6px;"><span style="color:#94a3b8;">Signal:</span> ${signalText}</div>
    ${channelText ? `<div style="margin-bottom: 6px;"><span style="color:#94a3b8;">Channel:</span> ${channelText}</div>` : ''}
    ${distanceText ? `<div style="margin-top: 8px; color:#fbbf24;">${distanceText}</div>` : ''}
  `;

  return popupShell({
    title: matched ? 'WiGLE + Local Match' : 'WiGLE External Observation',
    subtitle: matched ? 'Correlated point' : 'Not in local captures',
    accent: matched ? '#22c55e' : '#f59e0b',
    body,
  });
};
