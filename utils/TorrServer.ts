import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { StorageKeys } from './StorageService';

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  authEnabled: boolean;
  username: string;
  password: string;
}

const TORRSERVER_CONFIGS_KEY = StorageKeys.TORRCLIENT_TORRSERVER_CONFIGS_KEY
const TORRSERVER_ACTIVE_ID_KEY = StorageKeys.TORRCLIENT_TORRSERVER_ACTIVE_ID_KEY

export const getServerConfigs = async (): Promise<ServerConfig[]> => {
  try {
    const serversJson = await AsyncStorage.getItem(TORRSERVER_CONFIGS_KEY);
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
export const getActiveServerId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TORRSERVER_ACTIVE_ID_KEY);
  } catch (error) {
    console.error('Error getting active server ID:', error);
    return null;
  }
};

/**
 * Get the active server configuration
 */
export const getActiveServerConfig = async (): Promise<ServerConfig | null> => {
  try {
    const servers = await getServerConfigs();
    const activeId = await getActiveServerId();
    
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
export const getTorrServerUrl = async (): Promise<string> => {
  try {
    const activeServer = await getActiveServerConfig();

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
export const getTorrServerAuthHeader = async (): Promise<{ Authorization: string } | null> => {
  try {
    const activeServer = await getActiveServerConfig();
    
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
export const getServerConnection = async (serverId: string): Promise<{
  url: string;
  authHeader: { Authorization: string } | null;
} | null> => {
  try {
    const servers = await getServerConfigs();
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
export const setServerConfigs = async (servers: ServerConfig[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TORRSERVER_CONFIGS_KEY, JSON.stringify(servers));
  } catch (error) {
    console.error('Error saving server configs:', error);
  }
};

/**
 * Set the active server
 */
export const setActiveServerId = async (serverId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TORRSERVER_ACTIVE_ID_KEY, serverId);
  } catch (error) {
    console.error('Error setting active server ID:', error);
  }
};

/**
 * Add a new server configuration
 */
export const addServerConfig = async (server: ServerConfig): Promise<void> => {
  try {
    const servers = await getServerConfigs();
    servers.push(server);
    await setServerConfigs(servers);
  } catch (error) {
    console.error('Error adding server config:', error);
  }
};

/**
 * Update a server configuration
 */
export const updateServerConfig = async (serverId: string, updates: Partial<ServerConfig>): Promise<void> => {
  try {
    const servers = await getServerConfigs();
    const updatedServers = servers.map(s => 
      s.id === serverId ? { ...s, ...updates } : s
    );
    await setServerConfigs(updatedServers);
  } catch (error) {
    console.error('Error updating server config:', error);
  }
};

/**
 * Delete a server configuration
 */
export const deleteServerConfig = async (serverId: string): Promise<void> => {
  try {
    const servers = await getServerConfigs();
    const filteredServers = servers.filter(s => s.id !== serverId);
    await setServerConfigs(filteredServers);

    // If deleted server was active, set first server as active
    const activeId = await getActiveServerId();
    if (activeId === serverId && filteredServers.length > 0) {
      await setActiveServerId(filteredServers[0].id);
    }
  } catch (error) {
    console.error('Error deleting server config:', error);
  }
};

/**
 * Legacy function for backward compatibility - saves to first server or creates one
 * @deprecated Use setServerConfigs instead
 */
export const setTorrServerUrl = async (url: string): Promise<void> => {
  try {
    const servers = await getServerConfigs();
    if (servers.length > 0) {
      await updateServerConfig(servers[0].id, { url });
    } else {
      const newServer: ServerConfig = {
        id: Date.now().toString(),
        name: 'Primary Server',
        url,
        authEnabled: false,
        username: '',
        password: '',
      };
      await addServerConfig(newServer);
      await setActiveServerId(newServer.id);
    }
  } catch (error) {
    console.error('Error saving TorrServer URL:', error);
  }
};

/**
 * Legacy function for backward compatibility - saves to first server or creates one
 * @deprecated Use setServerConfigs instead
 */
export const setTorrServerAuth = async (enabled: boolean, username: string, password: string): Promise<void> => {
  try {
    const servers = await getServerConfigs();
    if (servers.length > 0) {
      await updateServerConfig(servers[0].id, {
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
      await addServerConfig(newServer);
      await setActiveServerId(newServer.id);
    }
  } catch (error) {
    console.error('Error saving TorrServer auth settings:', error);
  }
};