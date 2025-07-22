import AsyncStorage from '@react-native-async-storage/async-storage';

export const getTorrServerUrl = async (): Promise<string | null> => {
  try {
    const url = await AsyncStorage.getItem('torrserverbaseurl');
    return url;
  } catch (error) {
    console.error('Error getting TorrServer URL:', error);
    return null;
  }
};

export const setTorrServerUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('torrserverbaseurl', url);
  } catch (error) {
    console.error('Error saving TorrServer URL:', error);
  }
};

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