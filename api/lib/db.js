// Edge-compatible database utilities
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

/**
 * Retries a failed fetch operation with exponential backoff
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Parsed JSON response
 */
async function fetchWithRetry(url, options, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`[MongoDB] Retrying operation (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Edge-compatible MongoDB client using fetch API
 */
export class MongoDBClient {
  constructor() {
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI is required');
    }
    this.baseUrl = MONGODB_URI;
  }

  /**
   * Find a single document
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @returns {Promise<Object|null>} Found document or null
   */
  async findOne(collection, query) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'findOne',
        query
      })
    });
  }

  /**
   * Find multiple documents
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @param {Object} options - Query options (sort, limit, etc.)
   * @returns {Promise<Array>} Array of found documents
   */
  async find(collection, query, options = {}) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'find',
        query,
        options
      })
    });
  }

  /**
   * Insert a single document
   * @param {string} collection - Collection name
   * @param {Object} document - Document to insert
   * @returns {Promise<Object>} Inserted document
   */
  async insertOne(collection, document) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'insertOne',
        document
      })
    });
  }

  /**
   * Update a single document
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @param {Object} update - Update operations
   * @returns {Promise<Object>} Update result
   */
  async updateOne(collection, filter, update) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'updateOne',
        filter,
        update
      })
    });
  }

  /**
   * Delete a single document
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @returns {Promise<Object>} Deletion result
   */
  async deleteOne(collection, filter) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'deleteOne',
        filter
      })
    });
  }

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @returns {Promise<number>} Number of matching documents
   */
  async count(collection, query) {
    return fetchWithRetry(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection,
        action: 'count',
        query
      })
    });
  }
}

// Export singleton instance
export const db = new MongoDBClient();
