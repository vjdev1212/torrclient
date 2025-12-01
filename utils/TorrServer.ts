import { Buffer } from 'buffer';
import { StorageKeys, storageService } from './StorageService';

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