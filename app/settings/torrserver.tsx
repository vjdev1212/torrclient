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
import { Ionicons } from '@expo/vector-icons';

const TorrServerScreen = () => {
  const [torrServerUrl, setTorrServerUrl] = useState('http://192.168.1.10:5665');
  const [authEnabled, setAuthEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        setSaving(false);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TorrServer</Text>
        <Text style={styles.headerSubtitle}>Configure your server connection</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Server Configuration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SERVER</Text>
          <View style={styles.card}>
            <View style={styles.inputWrapper}>
              <View style={styles.labelRow}>
                <Ionicons name="server-outline" size={18} color="#535aff" style={styles.labelIcon} />
                <Text style={styles.label}>Base URL</Text>
              </View>
              <TextInput
                style={styles.input}
                value={torrServerUrl}
                onChangeText={setTorrServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.10:5665"
                placeholderTextColor="#666"
              />
            </View>
          </View>
        </View>

        {/* Authentication Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AUTHENTICATION</Text>
          <View style={styles.card}>
            <View style={styles.toggleWrapper}>
              <View style={styles.toggleLeft}>
                <View style={styles.toggleIconContainer}>
                  <Ionicons
                    name={authEnabled ? "lock-closed" : "lock-open-outline"}
                    size={20}
                    color="#535aff"
                  />
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Enable Authentication</Text>
                  <Text style={styles.toggleDescription}>
                    {authEnabled ? 'Authentication is enabled' : 'No authentication required'}
                  </Text>
                </View>
              </View>
              <Switch
                value={authEnabled}
                onValueChange={setAuthEnabled}
                thumbColor={authEnabled ? '#535aff' : '#666'}
                trackColor={{ false: '#2a2a2a', true: 'rgba(83, 90, 255, 0.3)' }}
                ios_backgroundColor="#2a2a2a"
              />
            </View>

            {authEnabled && (
              <>
                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="person-outline" size={18} color="#535aff" style={styles.labelIcon} />
                    <Text style={styles.label}>Username</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    placeholder="Enter username"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Ionicons name="key-outline" size={18} color="#535aff" style={styles.labelIcon} />
                    <Text style={styles.label}>Password</Text>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholder="Enter password"
                      placeholderTextColor="#666"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#666"
                      />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Save Button */}
        <Pressable
          onPress={savePreferences}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.saveButtonPressed,
            saving && styles.saveButtonDisabled
          ]}
        >
          <Ionicons
            name={saving ? "hourglass-outline" : "checkmark-circle-outline"}
            size={20}
            color="#fff"
            style={styles.saveButtonIcon}
          />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Text>
        </Pressable>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#535aff" />
          <Text style={styles.infoText}>
            Make sure your TorrServer is running and accessible from this device.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    margin: 'auto',
    maxWidth: 780
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#888',
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  inputWrapper: {
    padding: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  labelIcon: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  input: {
    height: 44,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  toggleWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  toggleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(83, 90, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#888',
  },
  separator: {
    height: 1,
    backgroundColor: '#2a2a2a',
  },
  saveButton: {
    backgroundColor: '#535aff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  saveButtonPressed: {
    backgroundColor: '#4248d9',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(83, 90, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(83, 90, 255, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
    marginLeft: 10,
  },
});

export default TorrServerScreen;