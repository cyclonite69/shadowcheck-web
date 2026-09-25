import { adminQuery } from '../adminDbService';

export type QueryExecutor = {
  query: (text: string, params?: any[]) => Promise<any>;
};

export const databaseExecutor: QueryExecutor = { query: adminQuery };
