// Edge-compatible database utilities
const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;

/**
 * Makes a fetch request to the MongoDB API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
async function mongoFetch(body) {
  try {
    const response = await fetch(MONGODB_URI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = new Error('Database operation failed');
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error('[DB Error]:', error);
    throw error;
  }
}

/**
 * Edge-compatible MongoDB operations
 */
export const db = {
  /**
   * Find a single document
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @returns {Promise<Object|null>} Found document or null
   */
  async findOne(collection, query) {
    const result = await mongoFetch({
      collection,
      action: 'findOne',
      query
    });
    return result || null;
  },

  /**
   * Find multiple documents
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @param {Object} options - Query options (sort, limit, etc.)
   * @returns {Promise<Array>} Array of found documents
   */
  async find(collection, query, options = {}) {
    const result = await mongoFetch({
      collection,
      action: 'find',
      query,
      options
    });
    return result || [];
  },

  /**
   * Insert a single document
   * @param {string} collection - Collection name
   * @param {Object} document - Document to insert
   * @returns {Promise<Object>} Inserted document
   */
  async insertOne(collection, document) {
    return await mongoFetch({
      collection,
      action: 'insertOne',
      document
    });
  },

  /**
   * Update a single document
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @param {Object} update - Update operations
   * @returns {Promise<Object>} Update result
   */
  async updateOne(collection, filter, update) {
    return await mongoFetch({
      collection,
      action: 'updateOne',
      query: filter,
      update
    });
  },

  /**
   * Delete a single document
   * @param {string} collection - Collection name
   * @param {Object} filter - Query filter
   * @returns {Promise<Object>} Deletion result
   */
  async deleteOne(collection, filter) {
    return await mongoFetch({
      collection,
      action: 'deleteOne',
      query: filter
    });
  },

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @param {Object} query - Query filter
   * @returns {Promise<number>} Number of matching documents
   */
  async count(collection, query) {
    const result = await mongoFetch({
      collection,
      action: 'count',
      query
    });
    return result || 0;
  },

  /**
   * Aggregate documents in a collection
   * @param {string} collection - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>} Aggregation results
   */
  async aggregate(collection, pipeline) {
    const result = await mongoFetch({
      collection,
      action: 'aggregate',
      pipeline
    });
    return result || [];
  }
};
