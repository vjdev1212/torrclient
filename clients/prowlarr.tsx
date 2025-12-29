import { StorageKeys, storageService } from '@/utils/StorageService';

interface CustomHeader {
  key: string;
  value: string;
}

interface ProwlarrConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  authEnabled: boolean;
  username: string;
  password: string;
  customHeaders: CustomHeader[];
}

export interface ProwlarrSearchResult {
  guid: string;
  title: string;
  indexer: string;
  indexerId: number;
  size: number;
  publishDate: string;
  downloadUrl: string;
  infoHash?: string;
  hash?: string;
  magnetUrl?: string;
  infoUrl?: string;
  seeders?: number;
  leechers?: number;
  protocol: 'torrent' | 'usenet';
  categories: number[];
  age?: number;
  ageHours?: number;
  ageMinutes?: number;
}

export interface ProwlarrSearchParams {
  query?: string;
  type?: string;
  indexerIds?: number[];
  categories?: number[]; // 2000 = Movies, 5000 = TV
  limit?: number;
  offset?: number;
}

export interface ProwlarrIndexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'torrent' | 'usenet';
  priority: number;
  categories: number[];
}

export interface ProwlarrCategory {
  id: number;
  name: string;
  subCategories: ProwlarrCategory[];
}

const PROWLARR_CONFIGS_KEY = StorageKeys.PROWLARR_CONFIGS_KEY;
const PROWLARR_ACTIVE_ID_KEY = StorageKeys.PROWLARR_ACTIVE_ID_KEY;

class ProwlarrClient {
  private config: ProwlarrConfig | null = null;

  /**
   * Initialize the client with the active Prowlarr instance configuration
   */
  async initialize(): Promise<boolean> {
    try {
      const configsJson = storageService.getItem(PROWLARR_CONFIGS_KEY);
      const activeId = storageService.getItem(PROWLARR_ACTIVE_ID_KEY);

      if (!configsJson || !activeId) {
        console.error('No Prowlarr configuration found');
        return false;
      }

      const configs: ProwlarrConfig[] = JSON.parse(configsJson);
      const activeConfig = configs.find(c => c.id === activeId);

      if (!activeConfig) {
        console.error('Active Prowlarr configuration not found');
        return false;
      }

      this.config = activeConfig;
      return true;
    } catch (error) {
      console.error('Failed to initialize Prowlarr client:', error);
      return false;
    }
  }

  /**
   * Get the authorization headers
   */
  private getHeaders(): Record<string, string> {
    if (!this.config) {
      throw new Error('Prowlarr client not initialized');
    }

    const headers: Record<string, string> = {
      'X-Api-Key': this.config.apiKey,
      'Content-Type': 'application/json',
    };

    // Add basic authentication if enabled
    if (this.config.authEnabled && this.config.username && this.config.password) {
      const credentials = btoa(`${this.config.username}:${this.config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Add custom headers
    if (this.config.customHeaders && this.config.customHeaders.length > 0) {
      this.config.customHeaders.forEach(header => {
        if (header.key && header.value) {
          headers[header.key] = header.value;
        }
      });
    }

    return headers;
  }

  /**
   * Build search URL with query parameters
   */
  private buildSearchUrl(params: ProwlarrSearchParams): string {
    if (!this.config) {
      throw new Error('Prowlarr client not initialized');
    }

    const baseUrl = this.config.url.endsWith('/')
      ? this.config.url.slice(0, -1)
      : this.config.url;

    const url = new URL(`${baseUrl}/api/v1/search`);

    // Add query parameter
    if (params.query) {
      url.searchParams.append('query', params.query);
    }

    // Add type
    if (params.type) {
      url.searchParams.append('type', params.type);
    }

    // Add indexer IDs
    if (params.indexerIds && params.indexerIds.length > 0) {
      params.indexerIds.forEach(id => {
        url.searchParams.append('indexerIds', id.toString());
      });
    }

    // Add categories (2000 = Movies, 5000 = TV)
    if (params.categories && params.categories.length > 0) {
      params.categories.forEach(cat => {
        url.searchParams.append('categories', cat.toString());
      });
    }

    // Add limit and offset
    if (params.limit) {
      url.searchParams.append('limit', params.limit.toString());
    }
    if (params.offset) {
      url.searchParams.append('offset', params.offset.toString());
    }

    return url.toString();
  }

  /**
   * Search for content using Prowlarr
   */
  async search(params: ProwlarrSearchParams): Promise<ProwlarrSearchResult[]> {
    try {
      if (!this.config) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Prowlarr client');
        }
      }

      const url = this.buildSearchUrl(params);
      const headers = this.getHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prowlarr API error (${response.status}): ${errorText}`);
      }

      const results: ProwlarrSearchResult[] = await response.json();
      return results;
    } catch (error) {
      console.error('Prowlarr search error:', error);
      throw error;
    }
  }

  /**
   * Search for movies by name
   */
  async searchMovieByName(name: string, limit: number = 50): Promise<ProwlarrSearchResult[]> {
    return this.search({
      query: name,
      type: 'movie',
      categories: [2000], // Movies category
      limit,
    });
  }

  /**
   * Search for TV shows by name
   */
  async searchTVShowByName(name: string, limit: number = 50): Promise<ProwlarrSearchResult[]> {
    return this.search({
      query: name,
      type: 'tvsearch',
      categories: [5000], // TV category
      limit,
    });
  }

  /**
   * Get all available indexers
   */
  async getIndexers(): Promise<ProwlarrIndexer[]> {
    try {
      if (!this.config) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Prowlarr client');
        }
      }

      const baseUrl = this.config?.url.endsWith('/')
        ? this.config.url.slice(0, -1)
        : this.config?.url;

      const url = `${baseUrl}/api/v1/indexer`;
      const headers = this.getHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prowlarr API error (${response.status}): ${errorText}`);
      }

      const indexers: ProwlarrIndexer[] = await response.json();
      return indexers;
    } catch (error) {
      console.error('Failed to fetch indexers:', error);
      throw error;
    }
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<ProwlarrCategory[]> {
    try {
      if (!this.config) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Prowlarr client');
        }
      }

      const baseUrl = this.config?.url.endsWith('/')
        ? this.config.url.slice(0, -1)
        : this.config?.url;

      const url = `${baseUrl}/api/v1/indexer/categories`;
      const headers = this.getHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prowlarr API error (${response.status}): ${errorText}`);
      }

      const categories: ProwlarrCategory[] = await response.json();
      return categories;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  }

  /**
   * Test connection to Prowlarr
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config) {
        const initialized = await this.initialize();
        if (!initialized) {
          return false;
        }
      }

      const baseUrl = this.config?.url.endsWith('/')
        ? this.config.url.slice(0, -1)
        : this.config?.url;

      const url = `${baseUrl}/api/v1/health`;
      const headers = this.getHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.error('Prowlarr connection test failed:', error);
      return false;
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static formatAge(ageMinutes?: number): string {
    if (!ageMinutes) return 'Unknown';

    const minutes = ageMinutes;
    const hours = minutes / 60;
    const days = hours / 24;
    const months = days / 30;
    const years = days / 365;

    if (minutes < 60) {
      return `${Math.floor(minutes)}m ago`;
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else if (days < 30) {
      return `${Math.floor(days)}d ago`;
    } else if (months < 12) {
      return `${Math.floor(months)}mo ago`;
    } else {
      return `${Math.floor(years)}y ago`;
    }
  }
}

export default ProwlarrClient;