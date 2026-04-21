import { networkApi } from '../../../../api/networkApi';
import { wigleApi } from '../../../../api/wigleApi';
import type { NetworkRow, NetworkTag } from '../../../../types/network';

export const handleTagAction = async (
  action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear',
  network: NetworkRow
): Promise<{ tag?: NetworkTag; deleted?: string; error?: string }> => {
  const bssid = network.bssid;
  let result;

  switch (action) {
    case 'ignore':
      result = await networkApi.ignoreNetwork(bssid);
      break;
    case 'threat':
      result = await networkApi.tagNetworkAsThreat(bssid, 'THREAT', 1.0);
      break;
    case 'suspect':
      result = await networkApi.tagNetworkAsThreat(bssid, 'SUSPECT', 0.7);
      break;
    case 'false_positive':
      result = await networkApi.falsePositiveNetwork(bssid);
      break;
    case 'clear':
      result = await networkApi.deleteNetworkTag(bssid);
      break;
    case 'investigate':
      throw new Error('Investigate action handled via dialog flow');
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  if (result && result.ok) {
    return { tag: result.tag, deleted: result.deleted };
  }
  return { error: result?.error || 'Unknown error' };
};
