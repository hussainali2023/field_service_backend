import { createClient } from "redis";
import config from "../config";

let isConnected = false;

export const redisClient = config.REDIS_URL
  ? createClient({ url: config.REDIS_URL })
  : createClient({
      username: config.REDIS_USER,
      password: config.REDIS_PASSWORD || undefined,
      socket: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn("⚠️ Redis max reconnection attempts reached. Continuing in memory-only fallback.");
            return false;
          }
          return Math.min(retries * 500, 2000);
        },
      },
    });

redisClient.on("connect", () => {
  isConnected = true;
  console.log("⚡ [Redis] Client connected successfully");
});

redisClient.on("ready", () => {
  isConnected = true;
});

redisClient.on("error", (err) => {
  isConnected = false;
  console.warn("⚠️ [Redis] Connection warning:", err?.message || err);
});

redisClient.on("end", () => {
  isConnected = false;
});

// In-memory fallback map when Redis is disconnected or during local tests
const memoryFallbackCache = new Map<string, { value: string; expiry: number | null }>();

export const initRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err: any) {
    console.warn("⚠️ [Redis] Initial connection could not be established. Falling back gracefully:", err?.message || err);
  }
};

export const isRedisConnected = () => isConnected && redisClient.isOpen;

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    if (isRedisConnected()) {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    }
  } catch (err) {
    console.warn(`[Redis getCache Error] key: ${key}`, err);
  }

  // Fallback to memory cache
  const item = memoryFallbackCache.get(key);
  if (!item) return null;
  if (item.expiry && item.expiry < Date.now()) {
    memoryFallbackCache.delete(key);
    return null;
  }
  return JSON.parse(item.value) as T;
};

export const setCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> => {
  const serialized = JSON.stringify(value);
  try {
    if (isRedisConnected()) {
      await redisClient.set(key, serialized, {
        expiration: {
          type: "EX",
          value: ttlSeconds,
        },
      });
      return;
    }
  } catch (err) {
    console.warn(`[Redis setCache Error] key: ${key}`, err);
  }

  // Fallback to memory cache
  memoryFallbackCache.set(key, {
    value: serialized,
    expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    if (isRedisConnected()) {
      await redisClient.del(key);
    }
  } catch (err) {
    console.warn(`[Redis deleteCache Error] key: ${key}`, err);
  }
  memoryFallbackCache.delete(key);
};

export const deleteCachePattern = async (pattern: string): Promise<void> => {
  try {
    if (isRedisConnected()) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    }
  } catch (err) {
    console.warn(`[Redis deleteCachePattern Error] pattern: ${pattern}`, err);
  }

  // Clear matching keys from memory fallback
  const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
  for (const key of memoryFallbackCache.keys()) {
    if (regex.test(key)) {
      memoryFallbackCache.delete(key);
    }
  }
};
