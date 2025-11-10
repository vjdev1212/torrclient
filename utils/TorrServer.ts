import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

// Automatically fallback to Docker proxy if no user config is found
export const getTorrServerUrl = async (): Promise<string> => {
  try {
    const url = await AsyncStorage.getItem('torrserverbaseurl');

    // If user has configured a base URL, use that (PWA mode)
    if (url && url.trim() !== '') {
      return url.trim().replace(/\/$/, ''); // remove trailing slash if any
    }

    // Else fallback to Docker mode using proxy
    return '/torrserver';
  } catch (error) {
    console.error('Error getting TorrServer URL:', error);
    return '/torrserver';
  }
};

// Auth header only if enabled and credentials are set
export const getTorrServerAuthHeader = async (): Promise<{ Authorization: string } | null> => {
  try {
    const enabled = await AsyncStorage.getItem('torrserverauthenabled');
    if (enabled !== 'true') return null;

    const username = await AsyncStorage.getItem('torrserverusername');
    const password = await AsyncStorage.getItem('torrserverpassword');

    if (!username || !password) return null;

    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${encoded}`,
    };
  } catch (error) {
    console.error('Error getting TorrServer Auth Header:', error);
    return null;
  }
};

// Optionally: Save functions
export const setTorrServerUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('torrserverbaseurl', url);
  } catch (error) {
    console.error('Error saving TorrServer URL:', error);
  }
};

export const setTorrServerAuth = async (enabled: boolean, username: string, password: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('torrserverauthenabled', enabled.toString());
    await AsyncStorage.setItem('torrserverusername', username);
    await AsyncStorage.setItem('torrserverpassword', password);
  } catch (error) {
    console.error('Error saving TorrServer auth settings:', error);
  }
};
