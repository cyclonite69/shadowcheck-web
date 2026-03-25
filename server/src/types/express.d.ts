declare global {
  namespace Express {
    interface Request {
      pagination?: { page: number; limit: number; offset: number };
      validated?: Record<string, unknown>;
    }
  }
}
export {};
