import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TextInput, Text, View, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from '@/components/Themed';
import { isHapticsSupported, showAlert } from '@/utils/platform';
import * as Haptics from 'expo-haptics';

const TorrServerScreen = () => {
  const [torrServerUrl, setTorrServerUrl] = useState('http://192.168.1.10:5665');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem('torrserverbaseurl');
        if (storedUrl) {
          setTorrServerUrl(storedUrl);
        }
      } catch (error) {
        console.error('Failed to load TorrServer URL:', error);
      }
    };
    loadPreferences();
  }, []);

  const savePreferences = async () => {
    try {
      if (isHapticsSupported()) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }

      if (!torrServerUrl.startsWith('http')) {
        showAlert('Invalid URL', 'Please enter a valid TorrServer base URL (http/https).');
        return;
      }

      await AsyncStorage.setItem('torrserverbaseurl', torrServerUrl);
    } catch (error) {
      console.error('Failed to save TorrServer URL:', error);
      showAlert('Error', 'Failed to save TorrServer URL.');
      return;
    }

    showAlert('Saved', 'TorrServer URL has been saved.');
  };

  const textInputStyle = styles.darkSearchInput;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.searchInputContainer}>
          <Text style={{ color: '#888', marginBottom: 10 }}>TorrServer Base URL:</Text>
          <TextInput
            style={[styles.searchInput, textInputStyle]}
            value={torrServerUrl}
            onChangeText={(text) => setTorrServerUrl(text)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://example.com"
            placeholderTextColor="#666"
          />
        </View>
        <View style={styles.saveButton}>
          <Pressable onPress={savePreferences}>
            <Text style={styles.saveButtonText}>Save</Text>
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
    marginBottom: 30,
    paddingHorizontal: 10,
    width: '100%',
  },
  searchInput: {
    height: 40,
    borderRadius: 12,
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
