import {
  getWigleDetail as getStoredWigleDetailRecord,
  getWigleV3Observations as getStoredWigleV3Observations,
  importWigleV3NetworkDetail as persistWigleV3NetworkDetail,
  importWigleV3Observation as persistWigleV3Observation,
  insertWigleV2SearchResult,
} from '../../repositories/wiglePersistenceRepository';
import { databaseExecutor, QueryExecutor } from './shared';

export async function getStoredWigleDetail(netid: string): Promise<any[]> {
  return getStoredWigleDetailRecord(databaseExecutor, netid);
}

export async function importWigleV3NetworkDetail(data: any): Promise<void> {
  await persistWigleV3NetworkDetail(databaseExecutor, data);
}

export async function importWigleV3Observation(
  netid: string,
  loc: any,
  ssid: string | null
): Promise<number> {
  return persistWigleV3Observation(databaseExecutor, netid, loc, ssid);
}

export async function getWigleV3Observations(netid: string): Promise<any[]> {
  return getStoredWigleV3Observations(databaseExecutor, netid);
}

export async function importWigleV2SearchResult(
  network: any,
  executor: QueryExecutor = databaseExecutor
): Promise<number> {
  return insertWigleV2SearchResult(executor, network);
}
