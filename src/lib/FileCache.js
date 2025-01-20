// utils/FileCache.js
export class FileCache {
    constructor(ttl = 1000 * 60 * 30) { // 30 minutes
      this.cache = new Map();
      this.ttl = ttl;
    }
  
    set(key, data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
    }
  
    get(key) {
      const item = this.cache.get(key);
      if (!item) return null;
      
      if (Date.now() - item.timestamp > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      return item.data;
    }
  
    invalidate(key) {
      this.cache.delete(key);
    }
  
    clear() {
      this.cache.clear();
    }
  }
  
  export const fileCache = new FileCache();