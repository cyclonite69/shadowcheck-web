import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

class CacheService {
  private client: RedisClient | null = null;
  private enabled = false;

  async connect() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      this.client = createClient({
        socket: {
          host: redisHost,
          port: redisPort,
          connectTimeout: 5000,
        },
      });

      this.client.on('error', (err) => {
        console.warn('Redis error:', err.message);
        this.enabled = false;
      });

      await this.client.connect();
      this.enabled = true;
      console.log(`✓ Redis connected: ${redisHost}:${redisPort}`);
    } catch (error) {
      console.warn('Redis unavailable, caching disabled:', (error as Error).message);
      this.enabled = false;
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Fail silently
    }
  }

  async del(key: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Fail silently
    }
  }

  async clear(pattern: string): Promise<void> {
    if (!this.enabled || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch {
      // Fail silently
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const cacheService = new CacheService();
