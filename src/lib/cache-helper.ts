/**
 * Простой in-memory кэш для оптимизации повторяющихся запросов
 */

interface CacheItem<T> {
  data: T;
  expires: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem<any>>();
  
  /**
   * Получить данные из кэша
   * @param key Ключ кэша
   * @returns Данные или null если не найдено/истекло
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  /**
   * Сохранить данные в кэш
   * @param key Ключ кэша
   * @param data Данные для сохранения
   * @param ttlMs Время жизни в миллисекундах (по умолчанию 1 минута)
   */
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs,
    });
  }
  
  /**
   * Удалить данные из кэша
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Очистить весь кэш
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Удалить все записи, начинающиеся с префикса
   */
  clearByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new CacheManager();

/**
 * Обёртка для кэширования результатов функций
 * @param key Ключ кэша
 * @param fn Функция для выполнения
 * @param ttlMs Время жизни в миллисекундах
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = 60000
): Promise<T> {
  const cached = cache.get<T>(key);
  
  if (cached !== null) {
    return cached;
  }
  
  const result = await fn();
  cache.set(key, result, ttlMs);
  
  return result;
}