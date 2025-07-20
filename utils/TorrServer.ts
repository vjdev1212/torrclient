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
