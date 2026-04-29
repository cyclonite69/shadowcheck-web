import type { Request, Response } from 'express';
import { parseNetworkListParams } from './parseParams';

export const createNetworkListHandler =
  (networkService: any) => async (req: Request, res: Response) => {
    const parsed = parseNetworkListParams(req);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ error: parsed.error });
    }

    const result = await networkService.getFilteredNetworks(parsed.params);
    if (result?.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.json(result);
  };
