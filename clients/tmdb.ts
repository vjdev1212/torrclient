const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

export interface TMDBSearchResponse {
  results: TMDBSearchResult[];
  page: number;
  total_pages: number;
  total_results: number;
}

class TMDBClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string = TMDB_API_KEY) {
    this.apiKey = apiKey;
    this.baseUrl = TMDB_BASE_URL;
  }

  /**
   * Search for movies by title
   */
  async searchMovies(query: string, page: number = 1): Promise<TMDBSearchResponse> {
    const url = `${this.baseUrl}/search/movie?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      ...data,
      results: data.results.map((item: any) => ({
        ...item,
        media_type: 'movie' as const,
      })),
    };
  }

  /**
   * Search for TV shows by title
   */
  async searchTV(query: string, page: number = 1): Promise<TMDBSearchResponse> {
    const url = `${this.baseUrl}/search/tv?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&page=${page}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      ...data,
      results: data.results.map((item: any) => ({
        ...item,
        media_type: 'tv' as const,
      })),
    };
  }

  /**
   * Get poster URL from poster_path
   */
  getPosterUrl(posterPath: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
    if (!posterPath) {
      return '';
    }
    return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`;
  }

  /**
   * Get IMDB ID from TMDB movie/TV ID
   */
  async getIMDBId(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<string | null> {
    const url = `${this.baseUrl}/${mediaType}/${tmdbId}/external_ids?api_key=${this.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.imdb_id || null;
  }
}

// Export singleton instance
export const tmdbClient = new TMDBClient();