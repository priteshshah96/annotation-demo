// Edge-compatible MongoDB client
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function fetchWithRetry(url, options, retryCount = 0) {
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

class MongoDBClient {
  constructor(uri) {
    const url = new URL(uri);
    const [username, password] = url.username ? [url.username, url.password] : [];
    const database = url.pathname.substring(1);
    
    this.baseUrl = `https://${url.host}/api/v1/databases/${database}/collections`;
    this.auth = username ? { username, password } : null;
  }

  async _fetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.auth && {
        'Authorization': 'Basic ' + Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64')
      }),
      ...options.headers
    };

    return fetchWithRetry(`${this.baseUrl}${path}`, {
      ...options,
      headers
    });
  }

  async findOne(collection, query) {
    const result = await this._fetch(`/${collection}/findOne`, {
      method: 'POST',
      body: JSON.stringify({ filter: query })
    });
    return result.document;
  }

  async find(collection, query, options = {}) {
    const result = await this._fetch(`/${collection}/find`, {
      method: 'POST',
      body: JSON.stringify({
        filter: query,
        ...options
      })
    });
    return result.documents;
  }

  async insertOne(collection, document) {
    const result = await this._fetch(`/${collection}/insertOne`, {
      method: 'POST',
      body: JSON.stringify({ document })
    });
    return result.insertedId;
  }

  async updateOne(collection, filter, update, options = {}) {
    const result = await this._fetch(`/${collection}/updateOne`, {
      method: 'POST',
      body: JSON.stringify({
        filter,
        update,
        ...options
      })
    });
    return result.modifiedCount;
  }

  async deleteOne(collection, filter) {
    const result = await this._fetch(`/${collection}/deleteOne`, {
      method: 'POST',
      body: JSON.stringify({ filter })
    });
    return result.deletedCount;
  }
}

let client = null;

export async function connectDB() {
  if (!client) {
    client = new MongoDBClient(MONGODB_URI);
    console.log('[MongoDB] Connected successfully');
  }
  return client;
}

export async function getDB() {
  if (!client) {
    await connectDB();
  }
  return client;
}