import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar, Text, View } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

const TorrServerScreen = () => {
  const [torrServerUrl, setTorrServerUrl] = useState('http://192.168.1.10:5665');
  const [authEnabled, setAuthEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem('torrserverbaseurl');
        const storedAuthEnabled = await AsyncStorage.getItem('torrserverauthenabled');
        const storedUsername = await AsyncStorage.getItem('torrserverusername');
        const storedPassword = await AsyncStorage.getItem('torrserverpassword');

        if (storedUrl) setTorrServerUrl(storedUrl);
        if (storedAuthEnabled === 'true') setAuthEnabled(true);
        if (storedUsername) setUsername(storedUsername);
        if (storedPassword) setPassword(storedPassword);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  const savePreferences = async () => {
    setSaving(true);
    try {
      if (isHapticsSupported()) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }

      if (!torrServerUrl.startsWith('http')) {
        showAlert('Invalid URL', 'Please enter a valid TorrServer base URL (http/https).');
        return;
      }

      await AsyncStorage.setItem('torrserverbaseurl', torrServerUrl);
      await AsyncStorage.setItem('torrserverauthenabled', authEnabled ? 'true' : 'false');

      if (authEnabled) {
        await AsyncStorage.setItem('torrserverusername', username);
        await AsyncStorage.setItem('torrserverpassword', password);
      } else {
        await AsyncStorage.removeItem('torrserverusername');
        await AsyncStorage.removeItem('torrserverpassword');
      }

      showAlert('Saved', 'TorrServer configuration saved.');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showAlert('Error', 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const textInputStyle = styles.darkSearchInput;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.label}>TorrServer Base URL:</Text>
          <TextInput
            style={[styles.searchInput, textInputStyle]}
            value={torrServerUrl}
            onChangeText={setTorrServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://example.com"
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.authToggleContainer}>
          <Text style={styles.label}>Enable Authentication</Text>
          <Switch
            value={authEnabled}
            onValueChange={setAuthEnabled}
            thumbColor={authEnabled ? '#535aff' : '#999'}
            trackColor={{ false: '#444', true: '#ccc' }}
          />
        </View>

        {authEnabled && (
          <>
            <View style={styles.searchInputContainer}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.searchInput, textInputStyle]}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="admin"
                placeholderTextColor="#aaa"
              />
            </View>

            <View style={styles.searchInputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.searchInput, textInputStyle]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="********"
                placeholderTextColor="#aaa"
              />
            </View>
          </>
        )}

        <View style={styles.saveButton}>
          <Pressable onPress={savePreferences} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 30,
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
  },
  content: {
    padding: 20,
  },
  searchInputContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
    width: '100%',
  },
  searchInput: {
    height: 40,
    borderRadius: 25,
    paddingLeft: 20,
    fontSize: 16,
  },
  lightSearchInput: {
    backgroundColor: '#f0f0f0',
    color: '#000',
  },
  darkSearchInput: {
    backgroundColor: '#1f1f1f',
    color: '#fff',
  },
  label: {
    color: '#ffffff',
    marginBottom: 10,
  },
  authToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#535aff',
    padding: 12,
    borderRadius: 30,
    alignSelf: 'center',
    alignItems: 'center',
    width: 150,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default TorrServerScreen;
