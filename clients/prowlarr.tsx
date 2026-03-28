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
  categories?: number[];
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
   * Initialize the client. Returns true if a valid, complete config was found.
   * Returns false silently if not configured — this is a normal state, not an error.
   */
  async initialize(): Promise<boolean> {
    try {
      const configsJson = storageService.getItem(PROWLARR_CONFIGS_KEY);
      const activeId = storageService.getItem(PROWLARR_ACTIVE_ID_KEY);

      if (!configsJson) return false;

      const configs: ProwlarrConfig[] = JSON.parse(configsJson);
      if (!configs.length) return false;

      // Prefer the saved active ID, fall back to first config
      const activeConfig = (activeId ? configs.find(c => c.id === activeId) : null) ?? configs[0];

      if (!activeConfig?.url || !activeConfig?.apiKey) return false;

      this.config = activeConfig;
      return true;
    } catch (error) {
      console.error('Failed to initialize Prowlarr client:', error);
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    if (!this.config) throw new Error('Prowlarr client not initialized');

    const headers: Record<string, string> = {
      'X-Api-Key': this.config.apiKey,
      'Content-Type': 'application/json',
    };

    if (this.config.authEnabled && this.config.username && this.config.password) {
      headers['Authorization'] = `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`;
    }

    this.config.customHeaders?.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });

    return headers;
  }

  private baseUrl(): string {
    if (!this.config) throw new Error('Prowlarr client not initialized');
    return this.config.url.endsWith('/') ? this.config.url.slice(0, -1) : this.config.url;
  }

  private buildSearchUrl(params: ProwlarrSearchParams): string {
    const url = new URL(`${this.baseUrl()}/api/v1/search`);
    if (params.query) url.searchParams.append('query', params.query);
    if (params.type) url.searchParams.append('type', params.type);
    params.indexerIds?.forEach(id => url.searchParams.append('indexerIds', id.toString()));
    params.categories?.forEach(cat => url.searchParams.append('categories', cat.toString()));
    if (params.limit) url.searchParams.append('limit', params.limit.toString());
    if (params.offset) url.searchParams.append('offset', params.offset.toString());
    return url.toString();
  }

  private async ensureConfig(): Promise<void> {
    if (!this.config) {
      const ok = await this.initialize();
      if (!ok) throw new Error('Prowlarr is not configured. Please add a URL and API key in Settings.');
    }
  }

  async search(params: ProwlarrSearchParams): Promise<ProwlarrSearchResult[]> {
    await this.ensureConfig();
    const response = await fetch(this.buildSearchUrl(params), {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Prowlarr API error (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }

  async searchMovieByName(name: string, limit = 50): Promise<ProwlarrSearchResult[]> {
    return this.search({ query: name, type: 'movie', categories: [2000], limit });
  }

  async searchTVShowByName(name: string, limit = 50): Promise<ProwlarrSearchResult[]> {
    return this.search({ query: name, type: 'tvsearch', categories: [5000], limit });
  }

  async getIndexers(): Promise<ProwlarrIndexer[]> {
    await this.ensureConfig();
    const response = await fetch(`${this.baseUrl()}/api/v1/indexer`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Prowlarr API error (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }

  async getCategories(): Promise<ProwlarrCategory[]> {
    await this.ensureConfig();
    const response = await fetch(`${this.baseUrl()}/api/v1/indexer/categories`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Prowlarr API error (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureConfig();
      const response = await fetch(`${this.baseUrl()}/api/v1/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
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
    const hours = ageMinutes / 60;
    const days = hours / 24;
    const months = days / 30;
    const years = days / 365;
    if (ageMinutes < 60) return `${Math.floor(ageMinutes)}m ago`;
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 30) return `${Math.floor(days)}d ago`;
    if (months < 12) return `${Math.floor(months)}mo ago`;
    return `${Math.floor(years)}y ago`;
  }
}

export default ProwlarrClient;