export interface CandidateTagObservation {
  bssid: string;
  detection_score: string | number;
  device_type?: string | null;
}

/**
 * Pure tag calculation helper mirroring server-side deriveVisintTags logic.
 */
export function getPreviewTags(
  selectedCandidateId: string | null,
  candidates?: CandidateTagObservation[] | null
): string[] {
  if (!selectedCandidateId) {
    return [];
  }

  const isUnmatched = selectedCandidateId === 'unmatched';
  const candidate = candidates?.find((c: any) => String(c.id) === selectedCandidateId);
  const autoTopId = candidates?.[0] ? String((candidates[0] as any).id) : null;
  const isManualOverride = !isUnmatched && selectedCandidateId !== autoTopId;
  const bssid = isUnmatched ? 'VISINT_UNMATCHED' : candidate?.bssid || 'VISINT_UNMATCHED';
  const score = Number(candidate?.detection_score || 0);
  const deviceType: string | null = candidate?.device_type || null;

  if (bssid === 'VISINT_UNMATCHED') {
    return ['UNMATCHED_NODE', 'VISINT_UNMATCHED'];
  }

  if (isManualOverride) {
    const tags = [
      'VISINT_SPATIAL_MATCH',
      'VISINT_MANUAL_MATCH',
      'VISINT_CONFIRMED',
      'GROUND_TRUTH_IMAGE',
    ];
    if (deviceType === 'SHOTSPOTTER_SENSOR') {
      tags.push('SHOTSPOTTER_SENSOR');
    } else if (deviceType === 'FLOCK_SAFETY_CAMERA') {
      tags.push(
        score >= 4 ? 'FLOCK_NEW_FIRMWARE' : score >= 3 ? 'FLOCK_LEGACY' : 'FLOCK_CANDIDATE'
      );
    }
    return tags;
  }

  if (deviceType === 'SHOTSPOTTER_SENSOR') {
    return score >= 2
      ? ['SHOTSPOTTER_SENSOR', 'VISINT_VERIFIED']
      : ['SHOTSPOTTER_SENSOR', 'VISINT_PENDING'];
  }

  if (deviceType === 'FLOCK_SAFETY_CAMERA') {
    if (score >= 4) {
      return ['FLOCK_NEW_FIRMWARE', 'VISINT_VERIFIED'];
    }
    if (score >= 3) {
      return ['FLOCK_LEGACY', 'VISINT_VERIFIED'];
    }
    if (score >= 1) {
      return ['FLOCK_CANDIDATE', 'VISINT_PENDING'];
    }
  }

  if (score >= 1) {
    return ['VISINT_PENDING'];
  }
  return ['VISINT_SPATIAL_MATCH'];
}
