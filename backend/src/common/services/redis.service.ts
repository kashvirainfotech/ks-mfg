import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly memoryFallback = new Map<
    string,
    { value: string; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 2) {
            this.logger.warn(
              'Redis not reachable locally; using in-memory token & cache store fallback.',
            );
            return null;
          }
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis server.');
      });

      this.client.on('error', () => {
        this.isConnected = false;
      });

      this.client.connect().catch(() => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    this.memoryFallback.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async get(key: string): Promise<string | null> {
    if (this.client && this.isConnected) {
      return this.client.get(key);
    }
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.del(key);
      return;
    }
    this.memoryFallback.delete(key);
  }

  async blacklistToken(jtiOrToken: string, ttlSeconds: number): Promise<void> {
    await this.set(`bl:${jtiOrToken}`, 'revoked', ttlSeconds);
  }

  async isTokenBlacklisted(jtiOrToken: string): Promise<boolean> {
    const val = await this.get(`bl:${jtiOrToken}`);
    return val === 'revoked';
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
  }
}
