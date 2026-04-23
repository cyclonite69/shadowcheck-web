import { query } from '../../config/database';

export type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

export const databaseExecutor: QueryExecutor = { query };
