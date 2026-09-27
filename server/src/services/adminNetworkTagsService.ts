export {};

import * as repo from '../repositories/adminNetworkTagRepository';
import {
  addTagToNetwork,
  getAllNetworkTags,
  getMACRandomizationSuspects,
  getNetworkTagsAndNotes,
  getNetworkTagsByBssid,
  getNetworkTagsExpanded,
  getOUIGroupDetails,
  getOUIGroups,
  insertNetworkTagWithNotes,
  removeTagFromNetwork,
  searchNetworksByTag,
  searchNetworksByTagArray,
} from '../repositories/adminNetworkTagOuiRepository';

const adminQuery = (text: string, params: any[] = []) =>
  require('../config/container').adminDbService.adminQuery(text, params);
const query = (text: string, params?: unknown[]) =>
  require('../config/container').databaseService.query(text, params);

module.exports = {
  checkDuplicateObservations: (bssid: string, time: number) =>
    repo.checkDuplicateObservations(query, bssid, time),
  addNetworkNote: (bssid: string, content: string) => repo.addNetworkNote(query, bssid, content),
  getNetworkSummary: (bssid: string) => repo.getNetworkSummary(query, bssid),
  getBackupData: () => repo.getBackupData(query),
  upsertNetworkTag: (
    bssid: string,
    is_ignored: boolean | null,
    ignore_reason: string | null,
    threat_tag: string | null,
    threat_confidence: number | null,
    notes: string | null
  ) =>
    repo.upsertNetworkTag(
      adminQuery,
      bssid,
      is_ignored,
      ignore_reason,
      threat_tag,
      threat_confidence,
      notes
    ),
  updateNetworkTagIgnore: (bssid: string, is_ignored: boolean, ignore_reason: string | null) =>
    repo.updateNetworkTagIgnore(adminQuery, bssid, is_ignored, ignore_reason),
  insertNetworkTagIgnore: (bssid: string, is_ignored: boolean, ignore_reason: string | null) =>
    repo.insertNetworkTagIgnore(adminQuery, bssid, is_ignored, ignore_reason),
  updateNetworkThreatTag: (bssid: string, threat_tag: string, threat_confidence: number | null) =>
    repo.updateNetworkThreatTag(adminQuery, bssid, threat_tag, threat_confidence),
  insertNetworkThreatTag: (bssid: string, threat_tag: string, threat_confidence: number | null) =>
    repo.insertNetworkThreatTag(adminQuery, bssid, threat_tag, threat_confidence),
  updateNetworkTagNotes: (bssid: string, notes: string) =>
    repo.updateNetworkTagNotes(adminQuery, bssid, notes),
  insertNetworkTagNotes: (bssid: string, notes: string) =>
    repo.insertNetworkTagNotes(adminQuery, bssid, notes),
  deleteNetworkTag: (bssid: string) => repo.deleteNetworkTag(adminQuery, bssid),
  requestWigleLookup: (bssid: string) => repo.requestWigleLookup(adminQuery, bssid),
  markNetworkInvestigate: (bssid: string) => repo.markNetworkInvestigate(adminQuery, bssid),
  fetchNetworksPendingWigleLookup: (limit: number) =>
    repo.fetchNetworksPendingWigleLookup(query, limit),
  exportMLTrainingSet: () => repo.exportMLTrainingSet(query),
  getNetworksPendingWigleLookup: (limit: number) =>
    repo.fetchNetworksPendingWigleLookup(query, limit),
  exportMLTrainingData: () => repo.exportMLTrainingSet(query),
  getOUIGroups,
  getOUIGroupDetails,
  getMACRandomizationSuspects,
  getNetworkTagsByBssid,
  getNetworkTagsAndNotes,
  getAllNetworkTags,
  searchNetworksByTag,
  insertNetworkTagWithNotes,
  removeTagFromNetwork,
  addTagToNetwork,
  getNetworkTagsExpanded,
  searchNetworksByTagArray,
};
