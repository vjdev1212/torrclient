import { Buffer } from 'buffer';
import { StorageKeys, storageService } from './StorageService';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { showAlert } from './platform';
import { isHapticsSupported } from './platform';

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  authEnabled: boolean;
  username: string;
  password: string;
}

const TORRSERVER_CONFIGS_KEY = StorageKeys.TORRSERVER_CONFIGS_KEY
const TORRSERVER_ACTIVE_ID_KEY = StorageKeys.TORRSERVER_ACTIVE_ID_KEY

export const getServerConfigs = (): ServerConfig[] => {
  try {
    const serversJson = storageService.getItem(TORRSERVER_CONFIGS_KEY);
    if (serversJson) {
      return JSON.parse(serversJson);
    }
    return [];
  } catch (error) {
    console.error('Error getting server configs:', error);
    return [];
  }
};

/**
 * Get the active server ID
 */
export const getActiveServerId = (): string | undefined => {
  try {
    return storageService.getItem(TORRSERVER_ACTIVE_ID_KEY);
  } catch (error) {
    console.error('Error getting active server ID:', error);
    return undefined;
  }
};

/**
 * Get the active server configuration
 */
export const getActiveServerConfig = (): ServerConfig | null => {
  try {
    const servers = getServerConfigs();
    const activeId = getActiveServerId();

    if (!servers.length) return null;

    const activeServer = servers.find(s => s.id === activeId);
    return activeServer || servers[0];
  } catch (error) {
    console.error('Error getting active server config:', error);
    return null;
  }
};

/**
 * Get TorrServer URL - automatically fallback to Docker proxy if no user config is found
 */
export const getTorrServerUrl = (): string => {
  try {
    const activeServer = getActiveServerConfig();

    // If user has configured a server with a URL, use that (PWA mode)
    if (activeServer?.url && activeServer.url.trim() !== '') {
      return activeServer.url.trim().replace(/\/$/, ''); // remove trailing slash if any
    }

    // Else fallback to Docker mode using proxy
    return '/torrserver';
  } catch (error) {
    console.error('Error getting TorrServer URL:', error);
    return '/torrserver';
  }
};

/**
 * Get auth header for the active server - only if enabled and credentials are set
 */
export const getTorrServerAuthHeader = (): { Authorization: string } | null => {
  try {
    const activeServer = getActiveServerConfig();

    if (!activeServer?.authEnabled) return null;
    if (!activeServer.username || !activeServer.password) return null;

    const credentials = `${activeServer.username}:${activeServer.password}`;
    const encoded = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${encoded}`,
    };
  } catch (error) {
    console.error('Error getting TorrServer Auth Header:', error);
    return null;
  }
};

/**
 * Get URL and auth header for a specific server by ID
 */
export const getServerConnection = (serverId: string): {
  url: string;
  authHeader: { Authorization: string } | null;
} | null => {
  try {
    const servers = getServerConfigs();
    const server = servers.find(s => s.id === serverId);

    if (!server) return null;

    const url = server.url.trim().replace(/\/$/, '');
    let authHeader = null;

    if (server.authEnabled && server.username && server.password) {
      const credentials = `${server.username}:${server.password}`;
      const encoded = Buffer.from(credentials).toString('base64');
      authHeader = { Authorization: `Basic ${encoded}` };
    }

    return { url, authHeader };
  } catch (error) {
    console.error('Error getting server connection:', error);
    return null;
  }
};

/**
 * Save server configurations
 */
export const setServerConfigs = (servers: ServerConfig[]): void => {
  try {
    storageService.setItem(TORRSERVER_CONFIGS_KEY, JSON.stringify(servers));
  } catch (error) {
    console.error('Error saving server configs:', error);
  }
};

/**
 * Set the active server
 */
export const setActiveServerId = (serverId: string): void => {
  try {
    storageService.setItem(TORRSERVER_ACTIVE_ID_KEY, serverId);
  } catch (error) {
    console.error('Error setting active server ID:', error);
  }
};

/**
 * Add a new server configuration
 */
export const addServerConfig = (server: ServerConfig): void => {
  try {
    const servers = getServerConfigs();
    servers.push(server);
    setServerConfigs(servers);
  } catch (error) {
    console.error('Error adding server config:', error);
  }
};

/**
 * Update a server configuration
 */
export const updateServerConfig = (serverId: string, updates: Partial<ServerConfig>): void => {
  try {
    const servers = getServerConfigs();
    const updatedServers = servers.map(s =>
      s.id === serverId ? { ...s, ...updates } : s
    );
    setServerConfigs(updatedServers);
  } catch (error) {
    console.error('Error updating server config:', error);
  }
};

/**
 * Delete a server configuration
 */
export const deleteServerConfig = (serverId: string): void => {
  try {
    const servers = getServerConfigs();
    const filteredServers = servers.filter(s => s.id !== serverId);
    setServerConfigs(filteredServers);

    // If deleted server was active, set first server as active
    const activeId = getActiveServerId();
    if (activeId === serverId && filteredServers.length > 0) {
      setActiveServerId(filteredServers[0].id);
    }
  } catch (error) {
    console.error('Error deleting server config:', error);
  }
};

/**
 * Legacy function for backward compatibility - saves to first server or creates one
 * @deprecated Use setServerConfigs instead
 */
export const setTorrServerUrl = (url: string): void => {
  try {
    const servers = getServerConfigs();
    if (servers.length > 0) {
      updateServerConfig(servers[0].id, { url });
    } else {
      const newServer: ServerConfig = {
        id: Date.now().toString(),
        name: 'Primary Server',
        url,
        authEnabled: false,
        username: '',
        password: '',
      };
      addServerConfig(newServer);
      setActiveServerId(newServer.id);
    }
  } catch (error) {
    console.error('Error saving TorrServer URL:', error);
  }
};

/**
 * Legacy function for backward compatibility - saves to first server or creates one
 * @deprecated Use setServerConfigs instead
 */
export const setTorrServerAuth = (enabled: boolean, username: string, password: string): void => {
  try {
    const servers = getServerConfigs();
    if (servers.length > 0) {
      updateServerConfig(servers[0].id, {
        authEnabled: enabled,
        username,
        password,
      });
    } else {
      const newServer: ServerConfig = {
        id: Date.now().toString(),
        name: 'Primary Server',
        url: 'http://',
        authEnabled: enabled,
        username,
        password,
      };
      addServerConfig(newServer);
      setActiveServerId(newServer.id);
    }
  } catch (error) {
    console.error('Error saving TorrServer auth settings:', error);
  }
};
export interface StreamingOptions {
  hash?: string;
  link?: string;
  fileId?: number;
  filePath?: string;
  title: string;
  fileTitle?: string;
  category?: string;
  onPreloadStart?: () => void;
  onPreloadEnd?: () => void;
}

/**
 * Preload a torrent file before streaming
 * @param options - Streaming options
 * @returns Promise<boolean> - Success status
 */
export const preloadTorrentFile = async (options: StreamingOptions): Promise<boolean> => {
  const { hash, link, fileId, filePath, onPreloadStart, onPreloadEnd } = options;
  
  try {
    if (onPreloadStart) {
      onPreloadStart();
    }

    const baseUrl = getTorrServerUrl();
    const authHeader = getTorrServerAuthHeader();
    
    let preloadUrl: string;
    
    if (filePath && hash) {
      // For torrent details screen with file path
      preloadUrl = `${baseUrl}/stream/${filePath}?link=${hash}&index=${fileId}&preload`;
    } else if (link) {
      // For search screen with magnet/torrent link
      const encodedLink = encodeURIComponent(link);
      preloadUrl = `${baseUrl}/stream?link=${encodedLink}&index=${fileId || 1}&preload`;
    } else {
      throw new Error('Invalid streaming options: must provide either filePath+hash or link');
    }

    const response = await fetch(preloadUrl, {
      method: 'GET',
      headers: { ...(authHeader || {}) },
    });

    if (!response.ok) {
      throw new Error(`Preload failed with status: ${response.status}`);
    }

    // Wait briefly to ensure preload has started
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  } catch (error) {
    console.error('Preload failed:', error);
    throw error;
  } finally {
    if (onPreloadEnd) {
      onPreloadEnd();
    }
  }
};

/**
 * Stream a torrent file with preloading
 * @param options - Streaming options
 */
export const streamTorrentFile = async (options: StreamingOptions): Promise<void> => {
  const { hash, link, fileId, filePath, title, fileTitle, category } = options;

  try {
    // Trigger haptic feedback
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Preload the file first
    await preloadTorrentFile(options);

    // Build stream URL
    const baseUrl = getTorrServerUrl();
    let streamUrl: string;

    if (filePath && hash) {
      // For torrent details screen
      streamUrl = `${baseUrl}/stream/${filePath}?link=${hash}&index=${fileId}&play&preload`;
    } else if (link) {
      // For search screen
      const encodedLink = encodeURIComponent(link);
      streamUrl = `${baseUrl}/stream?link=${encodedLink}&index=${fileId || 1}&play&preload`;
    } else {
      throw new Error('Invalid streaming options');
    }

    // Navigate to player
    router.push({
      pathname: '/stream/player',
      params: {
        url: streamUrl,
        title: title,
        fileTitle: fileTitle || title,
        category: category,
      },
    });
  } catch (error) {
    console.error('Stream failed:', error);
    showAlert('Playback Error', 'Unable to start playback. Please try again.');
  }
};

/**
 * Preload only (without playing)
 * @param options - Streaming options
 */
export const preloadOnly = async (options: StreamingOptions): Promise<void> => {
  try {
    if (isHapticsSupported()) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await preloadTorrentFile(options);
    showAlert('Success', 'File preload started successfully.');
  } catch (error) {
    console.error('Preload failed:', error);
    showAlert('Preload Failed', 'Unable to start preload. Please try again.');
  }
};

/**
 * Extract file name from path
 * @param path - File path
 * @returns File name
 */
export const extractFileName = (path: string): string => {
  return path.split('/').pop() || path;
};

/**
 * Format bytes to human-readable format
 * @param bytes - Number of bytes
 * @returns Formatted string
 */
export const formatBytes = (bytes: number | string): string => {
  const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (!size || size === 0 || isNaN(size)) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const value = size / Math.pow(1024, i);
  
  return `${value.toFixed(2)} ${units[i]}`;
};